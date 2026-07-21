"""Gather a snapshot of the brain for the CEO agent.

The CEO agent reasons over one structured context object per tenant, assembled
from the same tables everything else reads (deals, tasks, tickets, approvals,
events). Money stays in agorot; the presentation layer formats ₪.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Approval, Deal, Event, Task, Ticket

OPEN_DEAL_STAGES = ("lead", "qualified", "proposal", "negotiation")
CLOSEABLE_STAGES = ("proposal", "negotiation")


def _aware(dt: datetime | None) -> datetime | None:
    """Normalize DB datetimes to UTC-aware (sqlite returns naive, postgres aware)."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@dataclass
class CeoContext:
    tenant_id: str
    pipeline_value_agorot: int = 0
    open_deals_count: int = 0
    won_this_month_agorot: int = 0
    closeable_deals: list[dict] = field(default_factory=list)
    deals_by_stage: dict[str, dict] = field(default_factory=dict)
    pending_approvals: list[dict] = field(default_factory=list)
    open_tasks: list[dict] = field(default_factory=list)
    open_tasks_count: int = 0
    urgent_tickets: list[dict] = field(default_factory=list)
    open_tickets_count: int = 0
    events_last_24h: int = 0
    inbound_last_24h: int = 0

    def to_dict(self) -> dict:
        return {
            "tenant_id": self.tenant_id,
            "pipeline_value_agorot": self.pipeline_value_agorot,
            "open_deals_count": self.open_deals_count,
            "won_this_month_agorot": self.won_this_month_agorot,
            "closeable_deals": self.closeable_deals,
            "deals_by_stage": self.deals_by_stage,
            "pending_approvals": self.pending_approvals,
            "open_tasks": self.open_tasks,
            "open_tasks_count": self.open_tasks_count,
            "urgent_tickets": self.urgent_tickets,
            "open_tickets_count": self.open_tickets_count,
            "events_last_24h": self.events_last_24h,
            "inbound_last_24h": self.inbound_last_24h,
        }


async def gather_context(session: AsyncSession, tenant_id: uuid.UUID) -> CeoContext:
    ctx = CeoContext(tenant_id=str(tenant_id))
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # --- deals -----------------------------------------------------------
    deal_rows = (
        await session.execute(select(Deal).where(Deal.tenant_id == tenant_id))
    ).scalars().all()

    # "won this month" is dated by the deal.won EVENT ts (close date), not by
    # Deal.created_at — a deal created months ago and won today counts today.
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
    won_this_month_ids = set(won_id_strings)

    by_stage: dict[str, dict] = {}
    for d in deal_rows:
        b = by_stage.setdefault(d.stage, {"count": 0, "value_agorot": 0})
        b["count"] += 1
        b["value_agorot"] += d.value_agorot or 0
        if d.stage in OPEN_DEAL_STAGES:
            ctx.open_deals_count += 1
            ctx.pipeline_value_agorot += d.value_agorot or 0
        if d.stage == "won" and str(d.id) in won_this_month_ids:
            ctx.won_this_month_agorot += d.value_agorot or 0
    ctx.deals_by_stage = by_stage

    # closeable deals — proposal/negotiation, biggest first (where to push)
    closeable = sorted(
        (d for d in deal_rows if d.stage in CLOSEABLE_STAGES),
        key=lambda d: d.value_agorot or 0,
        reverse=True,
    )[:5]
    ctx.closeable_deals = [
        {
            "title": d.title,
            "stage": d.stage,
            "value_agorot": d.value_agorot or 0,
            "who": getattr(d, "account_name", None) or getattr(d, "contact_name", None),
        }
        for d in closeable
    ]

    # --- pending approvals (the boss's decisions) ------------------------
    approvals = (
        await session.execute(
            select(Approval)
            .where(Approval.tenant_id == tenant_id, Approval.status == "pending")
            .order_by(Approval.created_at.desc())
            .limit(8)
        )
    ).scalars().all()
    ctx.pending_approvals = [
        {
            "id": str(a.id),
            "agent": a.requested_by_agent,
            "action_type": a.action_type,
            "preview_text": a.preview_text,
        }
        for a in approvals
    ]

    # --- open tasks ------------------------------------------------------
    open_tasks = (
        await session.execute(
            select(Task)
            .where(Task.tenant_id == tenant_id, Task.status != "done")
            .order_by(Task.due_at.asc().nulls_last())
        )
    ).scalars().all()
    ctx.open_tasks_count = len(open_tasks)
    prio = {"high": 0, "normal": 1, "low": 2}
    top_tasks = sorted(open_tasks, key=lambda t: prio.get(t.priority, 1))[:5]
    ctx.open_tasks = [
        {"title": t.title, "priority": t.priority, "due_at": t.due_at.isoformat() if t.due_at else None}
        for t in top_tasks
    ]

    # --- open / urgent tickets -------------------------------------------
    open_tickets = (
        await session.execute(
            select(Ticket).where(
                Ticket.tenant_id == tenant_id,
                Ticket.status.in_(("new", "open", "pending")),
            )
        )
    ).scalars().all()
    ctx.open_tickets_count = len(open_tickets)
    tprio = {"urgent": 0, "high": 1, "normal": 2, "low": 3}
    urgent = sorted(open_tickets, key=lambda t: tprio.get(t.priority, 2))[:5]
    ctx.urgent_tickets = [
        {"subject": t.subject, "priority": t.priority, "status": t.status} for t in urgent
    ]

    # --- activity (events in last 24h) -----------------------------------
    ctx.events_last_24h = (
        await session.execute(
            select(func.count())
            .select_from(Event)
            .where(Event.tenant_id == tenant_id, Event.ts >= day_ago)
        )
    ).scalar_one()
    ctx.inbound_last_24h = (
        await session.execute(
            select(func.count())
            .select_from(Event)
            .where(
                Event.tenant_id == tenant_id,
                Event.ts >= day_ago,
                Event.verb == "message.received",
            )
        )
    ).scalar_one()

    return ctx
