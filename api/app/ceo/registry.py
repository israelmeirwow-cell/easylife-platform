"""Analyst registry — add analyst #N by writing one file, zero orchestrator edits.

Each analyst subclasses `Analyst`; subclassing auto-registers it. The runner
iterates the registry. Contract:

    compute(session, tenant_id) -> metrics payload (exact SQL/Python numbers)
    detect(metrics)             -> list[FindingDraft] (pure threshold rules)

Analysts NEVER call an LLM and NEVER round numbers — narrative is synthesis's
job. Per-tenant threshold overrides come from agent_configs
(agent_kind='ceo.analyst.<kind>', config jsonb).
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentConfig


@dataclass
class FindingDraft:
    """What an analyst emits; the runner turns drafts into persisted Findings."""

    kind: str  # dotted slug, e.g. 'pipeline.stalled_deal'
    severity: str  # critical|high|medium|low|info
    title_he: str
    summary_he: str  # MUST contain the exact numbers (template-rendered)
    metrics: dict[str, Any] = field(default_factory=dict)
    evidence: list[dict] = field(default_factory=list)  # [{entity_type, entity_id, role}]
    recommendation: dict | None = None  # {action_he, why_he, priority, approval_action_type?}
    falsifiability: dict | None = None  # {statement_he, metric, baseline, comparator, target, horizon_days}
    confidence: float = 1.0
    window_from: datetime | None = None
    window_to: datetime | None = None

    def dedupe_key(self, tenant_id: uuid.UUID) -> str:
        """Stable identity: same kind + same primary entities = same finding."""
        entity_ids = sorted(
            str(e.get("entity_id")) for e in self.evidence if e.get("role", "subject") == "subject"
        )
        raw = f"{tenant_id}|{self.kind}|{'|'.join(entity_ids)}"
        return hashlib.sha1(raw.encode()).hexdigest()


_REGISTRY: dict[str, type["Analyst"]] = {}


class Analyst:
    """Base class. Subclass with a unique `kind`; registration is automatic."""

    kind: ClassVar[str] = ""  # 'pipeline', 'service', 'approvals', ...
    title_he: ClassVar[str] = ""
    # findings this analyst may emit (documentation + future filtering)
    emits: ClassVar[tuple[str, ...]] = ()
    # default thresholds; overridable per tenant via agent_configs
    defaults: ClassVar[dict[str, Any]] = {}

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if not cls.kind:
            raise TypeError(f"{cls.__name__} must define a non-empty `kind`")
        if cls.kind in _REGISTRY:
            raise TypeError(f"duplicate analyst kind {cls.kind!r}")
        _REGISTRY[cls.kind] = cls

    async def config(self, session: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
        """defaults ∪ per-tenant overrides from agent_configs."""
        row = (
            await session.execute(
                select(AgentConfig).where(
                    AgentConfig.tenant_id == tenant_id,
                    AgentConfig.agent_kind == f"ceo.analyst.{self.kind}",
                    AgentConfig.status == "active",
                )
            )
        ).scalar_one_or_none()
        merged = dict(self.defaults)
        if row and isinstance(row.config, dict):
            merged.update(row.config)
        return merged

    async def compute(self, session: AsyncSession, tenant_id: uuid.UUID, cfg: dict) -> dict:
        raise NotImplementedError

    def detect(self, metrics: dict, cfg: dict) -> list[FindingDraft]:
        raise NotImplementedError


def all_analysts() -> list[Analyst]:
    """Instantiate every registered analyst (import side-effect registers them)."""
    # importing the package triggers registration of all analyst modules
    from app.ceo import analysts  # noqa: F401

    return [cls() for cls in _REGISTRY.values()]


def get_analyst(kind: str) -> Analyst | None:
    from app.ceo import analysts  # noqa: F401

    cls = _REGISTRY.get(kind)
    return cls() if cls else None
