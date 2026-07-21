"""Dashboard summary: tenant-scoped CRM counters + pipeline math.

Read-only aggregation over contacts / leads / deals / tasks / tickets. Money is
integer agorot throughout (CLAUDE.md).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_tenant_id
from app.models import (
    DEAL_OPEN_STAGES,
    DEAL_STAGES,
    TICKET_OPEN_STATUSES,
    Contact,
    Deal,
    Event,
    Lead,
    Task,
    Ticket,
)
from app.schemas import DashboardSummary, DealStageBucket

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> DashboardSummary:
    contacts_count = (
        await session.execute(
            select(func.count()).select_from(Contact).where(Contact.tenant_id == tenant_id)
        )
    ).scalar_one()

    leads_count = (
        await session.execute(
            select(func.count())
            .select_from(Lead)
            .where(Lead.tenant_id == tenant_id, Lead.stage == "new")
        )
    ).scalar_one()

    # Deals grouped by stage: count + summed value.
    stage_rows = (
        await session.execute(
            select(
                Deal.stage,
                func.count(),
                func.coalesce(func.sum(Deal.value_agorot), 0),
            )
            .where(Deal.tenant_id == tenant_id)
            .group_by(Deal.stage)
        )
    ).all()
    stage_map = {
        stage: {"count": int(count), "value_agorot": int(value)}
        for stage, count, value in stage_rows
    }
    deals_by_stage = [
        DealStageBucket(
            stage=stage,
            count=stage_map.get(stage, {}).get("count", 0),
            value_agorot=stage_map.get(stage, {}).get("value_agorot", 0),
        )
        for stage in DEAL_STAGES
    ]

    open_deals_count = sum(
        bucket.count for bucket in deals_by_stage if bucket.stage in DEAL_OPEN_STAGES
    )
    pipeline_value_agorot = sum(
        bucket.value_agorot for bucket in deals_by_stage if bucket.stage in DEAL_OPEN_STAGES
    )

    tasks_open_count = (
        await session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.tenant_id == tenant_id, Task.status != "done")
        )
    ).scalar_one()

    tickets_open_count = (
        await session.execute(
            select(func.count())
            .select_from(Ticket)
            .where(Ticket.tenant_id == tenant_id, Ticket.status.in_(TICKET_OPEN_STATUSES))
        )
    ).scalar_one()

    # "Won this month" is dated by the deal.won EVENT (close date), not by
    # Deal.created_at — a deal created months ago and won today counts today.
    # Two portable queries (events.entity_id is a dashed-uuid string; Deal.id
    # column format differs between sqlite/postgres, so match in Python).
    month_start = _month_start(datetime.now(timezone.utc))
    won_id_strings = (
        (
            await session.execute(
                select(Event.entity_id).where(
                    Event.tenant_id == tenant_id,
                    Event.verb == "deal.won",
                    Event.ts >= month_start,
                    Event.entity_id.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    won_ids = []
    for raw in set(won_id_strings):
        try:
            won_ids.append(uuid.UUID(raw))
        except (ValueError, TypeError):
            continue
    won_this_month_agorot = 0
    if won_ids:
        won_this_month_agorot = (
            await session.execute(
                select(func.coalesce(func.sum(Deal.value_agorot), 0)).where(
                    Deal.tenant_id == tenant_id,
                    Deal.stage == "won",
                    Deal.id.in_(won_ids),
                )
            )
        ).scalar_one()

    return DashboardSummary(
        contacts_count=int(contacts_count),
        leads_count=int(leads_count),
        open_deals_count=int(open_deals_count),
        pipeline_value_agorot=int(pipeline_value_agorot),
        deals_by_stage=deals_by_stage,
        tasks_open_count=int(tasks_open_count),
        tickets_open_count=int(tickets_open_count),
        won_this_month_agorot=int(won_this_month_agorot),
    )
