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
from app.models import Activity
from app.schemas import (
    CountBucket,
    DashboardAnalytics,
    DashboardSummary,
    DealStageBucket,
    MonthBucket,
    TopDeal,
)

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


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _last_months(now: datetime, n: int = 6) -> list[str]:
    keys = []
    year, month = now.year, now.month
    for _ in range(n):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(keys))


@router.get("/analytics", response_model=DashboardAnalytics)
async def dashboard_analytics(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> DashboardAnalytics:
    """Detailed business analytics: monthly deal flow, funnels, activity rhythm.

    Aggregation happens in Python over tenant-scoped rows — portable across
    sqlite (tests) and postgres, and the row counts at SMB scale are small.
    """
    now = datetime.now(timezone.utc)
    months = _last_months(now, 6)

    # --- monthly deal flow: created (by Deal.created_at) + won (by deal.won event) ---
    deals = (
        await session.execute(
            select(Deal.id, Deal.title, Deal.stage, Deal.value_agorot, Deal.created_at).where(
                Deal.tenant_id == tenant_id
            )
        )
    ).all()
    value_by_id = {str(d.id): int(d.value_agorot or 0) for d in deals}

    created_by_month: dict[str, int] = {m: 0 for m in months}
    for d in deals:
        key = _month_key(d.created_at) if d.created_at else None
        if key in created_by_month:
            created_by_month[key] += 1

    won_events = (
        await session.execute(
            select(Event.entity_id, Event.ts).where(
                Event.tenant_id == tenant_id,
                Event.verb == "deal.won",
                Event.entity_id.is_not(None),
            )
        )
    ).all()
    won_count_by_month: dict[str, int] = {m: 0 for m in months}
    won_agorot_by_month: dict[str, int] = {m: 0 for m in months}
    won_total_agorot = 0
    seen_won: set[str] = set()
    for entity_id, ts in won_events:
        if entity_id in seen_won:
            continue
        seen_won.add(entity_id)
        value = value_by_id.get(entity_id, 0)
        won_total_agorot += value
        key = _month_key(ts) if ts else None
        if key in won_count_by_month:
            won_count_by_month[key] += 1
            won_agorot_by_month[key] += value

    monthly = [
        MonthBucket(
            month=m,
            created_count=created_by_month[m],
            won_count=won_count_by_month[m],
            won_agorot=won_agorot_by_month[m],
        )
        for m in months
    ]

    # --- leads funnel ---
    lead_rows = (
        await session.execute(
            select(Lead.stage, func.count())
            .where(Lead.tenant_id == tenant_id)
            .group_by(Lead.stage)
        )
    ).all()
    lead_map = {stage: int(count) for stage, count in lead_rows}
    lead_stages = ("new", "contacted", "qualified", "won", "lost")
    leads_funnel = [CountBucket(key=s, count=lead_map.get(s, 0)) for s in lead_stages]

    # --- tickets by status ---
    ticket_rows = (
        await session.execute(
            select(Ticket.status, func.count())
            .where(Ticket.tenant_id == tenant_id)
            .group_by(Ticket.status)
        )
    ).all()
    ticket_map = {status: int(count) for status, count in ticket_rows}
    ticket_statuses = ("new", "open", "pending", "resolved", "closed")
    tickets_by_status = [CountBucket(key=s, count=ticket_map.get(s, 0)) for s in ticket_statuses]

    # --- activity rhythm by weekday (ISO: 0=Monday .. 6=Sunday) ---
    activity_rows = (
        await session.execute(
            select(Activity.occurred_at).where(Activity.tenant_id == tenant_id)
        )
    ).scalars().all()
    weekday_counts = [0] * 7
    for occurred_at in activity_rows:
        if occurred_at is not None:
            weekday_counts[occurred_at.weekday()] += 1
    activity_by_weekday = [
        CountBucket(key=str(i), count=weekday_counts[i]) for i in range(7)
    ]

    # --- top open deals by value ---
    open_deals = [d for d in deals if d.stage in DEAL_OPEN_STAGES]
    open_deals.sort(key=lambda d: int(d.value_agorot or 0), reverse=True)
    top_open_deals = [
        TopDeal(id=str(d.id), title=d.title, stage=d.stage, value_agorot=int(d.value_agorot or 0))
        for d in open_deals[:5]
    ]

    # --- headline ratios ---
    won_deals = [d for d in deals if d.stage == "won"]
    lost_deals = [d for d in deals if d.stage == "lost"]
    closed = len(won_deals) + len(lost_deals)
    win_rate_pct = round(100.0 * len(won_deals) / closed, 1) if closed else 0.0
    avg_deal_agorot = (
        int(sum(int(d.value_agorot or 0) for d in won_deals) / len(won_deals))
        if won_deals
        else 0
    )

    return DashboardAnalytics(
        monthly=monthly,
        leads_funnel=leads_funnel,
        tickets_by_status=tickets_by_status,
        activity_by_weekday=activity_by_weekday,
        top_open_deals=top_open_deals,
        won_total_agorot=won_total_agorot,
        avg_deal_agorot=avg_deal_agorot,
        win_rate_pct=win_rate_pct,
    )
