"""Approvals inbox: list pending + decide (approve/reject).

State machine (CLAUDE.md): pending -> approved -> executed|failed;
pending -> rejected; pending -> expired. Every transition emits an event.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import optional_current_user
from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import APPROVAL_TRANSITIONS, Approval, User
from app.schemas import ApprovalDecision, ApprovalOut

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


def _assert_transition(current: str, target: str) -> None:
    allowed = APPROVAL_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid approval transition {current!r} -> {target!r}",
        )


@router.get("", response_model=list[ApprovalOut])
async def list_approvals(
    status: str = Query("pending"),
    limit: int = Query(100, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Approval]:
    query = select(Approval).where(Approval.tenant_id == tenant_id)
    if status != "all":
        query = query.where(Approval.status == status)
    result = await session.execute(query.order_by(Approval.created_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.post("/{approval_id}/decide", response_model=ApprovalOut)
async def decide_approval(
    approval_id: uuid.UUID,
    body: ApprovalDecision,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    user: User | None = Depends(optional_current_user),
    session: AsyncSession = Depends(get_session),
) -> Approval:
    result = await session.execute(
        select(Approval).where(Approval.tenant_id == tenant_id, Approval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval not found")

    target_status = "approved" if body.decision == "approve" else "rejected"
    _assert_transition(approval.status, target_status)

    approval.status = target_status
    approval.decided_by = user.id if user is not None else None
    approval.decided_at = datetime.now(timezone.utc)

    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="approval.decided",
        entity_type="approval",
        entity_id=approval.id,
        payload={
            "decision": body.decision,
            "status": target_status,
            "action_type": approval.action_type,
            "preview_text": approval.preview_text,
            "requested_by_agent": approval.requested_by_agent,
        },
    )
    await session.commit()
    return approval
