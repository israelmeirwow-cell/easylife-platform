"""Deals: list (filter by stage/pipeline) / create / get / patch.

PATCH is the pipeline board: a stage change emits deal.stage_changed (plus
deal.won / deal.lost on those terminal stages); any other field change emits
deal.updated. Every write shares the row's transaction.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Deal
from app.schemas import DealCreate, DealOut, DealUpdate

router = APIRouter(prefix="/api/deals", tags=["deals"])


async def _get_deal_or_404(
    session: AsyncSession, tenant_id: uuid.UUID, deal_id: uuid.UUID
) -> Deal:
    result = await session.execute(
        select(Deal).where(Deal.tenant_id == tenant_id, Deal.id == deal_id)
    )
    deal = result.scalar_one_or_none()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("", response_model=list[DealOut])
async def list_deals(
    stage: str | None = Query(None),
    pipeline: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Deal]:
    query = select(Deal).where(Deal.tenant_id == tenant_id)
    if stage is not None:
        query = query.where(Deal.stage == stage)
    if pipeline is not None:
        query = query.where(Deal.pipeline == pipeline)
    result = await session.execute(query.order_by(Deal.created_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.post("", response_model=DealOut, status_code=201)
async def create_deal(
    body: DealCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Deal:
    deal = Deal(tenant_id=tenant_id, **body.model_dump())
    session.add(deal)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="deal.created",
        entity_type="deal",
        entity_id=deal.id,
        payload={
            "title": deal.title,
            "stage": deal.stage,
            "pipeline": deal.pipeline,
            "value_agorot": deal.value_agorot,
            "account_id": str(deal.account_id) if deal.account_id else None,
            "contact_id": str(deal.contact_id) if deal.contact_id else None,
        },
    )
    await session.commit()
    return deal


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal(
    deal_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> Deal:
    return await _get_deal_or_404(session, tenant_id, deal_id)


@router.patch("/{deal_id}", response_model=DealOut)
async def update_deal(
    deal_id: uuid.UUID,
    body: DealUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Deal:
    deal = await _get_deal_or_404(session, tenant_id, deal_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return deal

    old_stage = deal.stage
    for field, value in changes.items():
        setattr(deal, field, value)

    new_stage = deal.stage
    base_payload = {
        "account_id": str(deal.account_id) if deal.account_id else None,
        "contact_id": str(deal.contact_id) if deal.contact_id else None,
        "value_agorot": deal.value_agorot,
    }

    if new_stage != old_stage:
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="deal.stage_changed",
            entity_type="deal",
            entity_id=deal.id,
            payload={"from": old_stage, "to": new_stage, **base_payload},
        )
        if new_stage == "won":
            await emit_event(
                session,
                tenant_id=tenant_id,
                actor_type="human",
                actor_id=actor_id,
                verb="deal.won",
                entity_type="deal",
                entity_id=deal.id,
                payload={"title": deal.title, **base_payload},
            )
        elif new_stage == "lost":
            await emit_event(
                session,
                tenant_id=tenant_id,
                actor_type="human",
                actor_id=actor_id,
                verb="deal.lost",
                entity_type="deal",
                entity_id=deal.id,
                payload={"title": deal.title, **base_payload},
            )
    else:
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="deal.updated",
            entity_type="deal",
            entity_id=deal.id,
            payload={"fields": sorted(changes.keys()), **base_payload},
        )

    await session.commit()
    return deal
