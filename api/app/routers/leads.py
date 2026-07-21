"""Leads: list + kanban stage changes (emits lead.stage_changed)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Lead
from app.schemas import LeadOut, LeadStageUpdate

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.get("", response_model=list[LeadOut])
async def list_leads(
    stage: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Lead]:
    query = select(Lead).where(Lead.tenant_id == tenant_id)
    if stage is not None:
        query = query.where(Lead.stage == stage)
    result = await session.execute(query.order_by(Lead.created_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead_stage(
    lead_id: uuid.UUID,
    body: LeadStageUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Lead:
    result = await session.execute(
        select(Lead).where(Lead.tenant_id == tenant_id, Lead.id == lead_id)
    )
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_stage = lead.stage
    if old_stage != body.stage:
        lead.stage = body.stage
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="lead.stage_changed",
            entity_type="lead",
            entity_id=lead.id,
            payload={
                "from": old_stage,
                "to": body.stage,
                "contact_id": str(lead.contact_id),
                "value_agorot": lead.value_agorot,
            },
        )
        await session.commit()
    return lead
