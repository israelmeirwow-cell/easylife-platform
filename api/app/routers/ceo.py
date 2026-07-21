"""CEO agent endpoints — the central brain's executive layer.

GET  /api/ceo/brief                     → run analysts + composed executive brief
GET  /api/ceo/findings                  → open findings (severity-ordered)
POST /api/ceo/findings/{id}/acknowledge|dismiss|act → status transitions (each emits an event)
POST /api/ceo/ask                       → free-text business Q&A from brain context
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ceo.brief import answer_question
from app.ceo.context import gather_context
from app.ceo.runner import compact_finding, open_findings, run_all
from app.ceo.synthesis import compose
from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Finding

router = APIRouter(prefix="/api/ceo", tags=["ceo"])


class AskBody(BaseModel):
    question: str


@router.get("/brief")
async def ceo_brief(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    counters = await run_all(session, tenant_id)
    ctx = await gather_context(session, tenant_id)
    findings = await open_findings(session, tenant_id)
    brief = await compose(session, tenant_id, ctx, findings)
    await session.commit()  # findings + events + usage metering
    brief["run"] = counters
    return brief


@router.get("/findings")
async def ceo_findings(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    rows = await open_findings(session, tenant_id, limit=50)
    return [compact_finding(f) for f in rows]


_TRANSITIONS = {
    "acknowledge": ("acknowledged", "finding.acknowledged"),
    "dismiss": ("dismissed", "finding.dismissed"),
    "act": ("acted", "finding.acted"),
}


@router.post("/findings/{finding_id}/{action}")
async def ceo_finding_action(
    finding_id: uuid.UUID,
    action: str,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if action not in _TRANSITIONS:
        raise HTTPException(status_code=404, detail="Unknown action")
    finding = (
        await session.execute(
            select(Finding).where(Finding.tenant_id == tenant_id, Finding.id == finding_id)
        )
    ).scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    new_status, verb = _TRANSITIONS[action]
    finding.status = new_status
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb=verb,
        entity_type="finding",
        entity_id=finding.id,
        payload={"kind": finding.kind, "title_he": finding.title_he},
    )
    await session.commit()
    return compact_finding(finding)


@router.post("/ask")
async def ceo_ask(
    body: AskBody,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    question = (body.question or "").strip()
    if not question:
        return {
            "answer": "שאל אותי משהו על העסק — לידים, עסקאות, משימות או מה חשוב היום.",
            "source": "rules",
        }
    return await answer_question(session, tenant_id, question)
