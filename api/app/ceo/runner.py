"""Analyst runner — compute → detect → dedupe → persist + feed, one transaction.

run_all(session, tenant_id) executes every registered analyst sequentially
(SQL-bound, sub-second at SMB scale). New findings are persisted AND emitted as
`finding.created` events in the same transaction, so they reach the live feed
via the existing EventBus/SSE with zero new plumbing. Re-detections of an open
finding bump last_seen_at instead of spamming; a severity change emits
`finding.updated`.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ceo.registry import FindingDraft, all_analysts
from app.events import emit_event
from app.models import Finding

logger = logging.getLogger("easylife.ceo.runner")

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def compact_finding(f: Finding) -> dict:
    """Small serializable form — used in event payloads and LLM synthesis input."""
    return {
        "id": str(f.id),
        "analyst": f.analyst,
        "kind": f.kind,
        "severity": f.severity,
        "title_he": f.title_he,
        "summary_he": f.summary_he,
        "metrics": f.metrics,
        "recommendation": f.recommendation,
        "confidence": f.confidence,
        "status": f.status,
    }


async def run_all(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Run every analyst; returns counters. Caller owns the commit."""
    now = datetime.now(timezone.utc)
    created = updated = refreshed = errors = 0

    # open findings by dedupe_key — the dedupe universe
    open_rows = (
        (
            await session.execute(
                select(Finding).where(
                    Finding.tenant_id == tenant_id, Finding.status == "open"
                )
            )
        )
        .scalars()
        .all()
    )
    open_by_key: dict[str, Finding] = {f.dedupe_key: f for f in open_rows}

    for analyst in all_analysts():
        try:
            cfg = await analyst.config(session, tenant_id)
            metrics = await analyst.compute(session, tenant_id, cfg)
            drafts: list[FindingDraft] = analyst.detect(metrics, cfg)
        except Exception:
            logger.exception("analyst %s failed for tenant %s", analyst.kind, tenant_id)
            errors += 1
            continue

        for draft in drafts:
            key = draft.dedupe_key(tenant_id)
            existing = open_by_key.get(key)
            if existing is not None:
                # still detected — refresh; escalate/de-escalate emits an update
                existing.last_seen_at = now
                existing.summary_he = draft.summary_he
                existing.metrics = draft.metrics
                if existing.severity != draft.severity:
                    old = existing.severity
                    existing.severity = draft.severity
                    await emit_event(
                        session,
                        tenant_id=tenant_id,
                        actor_type="agent",
                        actor_id=f"ceo.analyst.{analyst.kind}",
                        verb="finding.updated",
                        entity_type="finding",
                        entity_id=existing.id,
                        payload={
                            "kind": existing.kind,
                            "severity_from": old,
                            "severity_to": draft.severity,
                            "title_he": existing.title_he,
                        },
                    )
                    updated += 1
                else:
                    refreshed += 1
                continue

            finding = Finding(
                tenant_id=tenant_id,
                analyst=analyst.kind,
                kind=draft.kind,
                severity=draft.severity,
                title_he=draft.title_he,
                summary_he=draft.summary_he,
                metrics=draft.metrics,
                evidence=draft.evidence,
                recommendation=draft.recommendation,
                falsifiability=draft.falsifiability,
                confidence=draft.confidence,
                window_from=draft.window_from,
                window_to=draft.window_to,
                dedupe_key=key,
                status="open",
                last_seen_at=now,
            )
            session.add(finding)
            await session.flush()
            await emit_event(
                session,
                tenant_id=tenant_id,
                actor_type="agent",
                actor_id=f"ceo.analyst.{analyst.kind}",
                verb="finding.created",
                entity_type="finding",
                entity_id=finding.id,
                payload=compact_finding(finding),
            )
            open_by_key[key] = finding
            created += 1

    return {"created": created, "updated": updated, "refreshed": refreshed, "errors": errors}


async def open_findings(
    session: AsyncSession, tenant_id: uuid.UUID, limit: int = 20
) -> list[Finding]:
    """Open findings ordered by severity then confidence — the brief's input."""
    rows = (
        (
            await session.execute(
                select(Finding).where(
                    Finding.tenant_id == tenant_id, Finding.status == "open"
                )
            )
        )
        .scalars()
        .all()
    )
    rows.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, 9), -f.confidence))
    return rows[:limit]
