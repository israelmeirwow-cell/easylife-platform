"""Prepaid credit engine: reserve -> commit/release, atomic per tenant.

Ported from openshorts cloud/metering.py (same accounting model, adapted
minutes->integer credits, user->tenant, own-session->caller's session):

* The plan grants `PLAN_MONTHLY_CREDITS[tenant.plan]` for the current calendar
  month (UTC). Usage against the plan is the sum of ledger rows tagged with the
  current `period_end` in status reserved|committed. Rows from previous months
  carry a different tag and stop counting automatically -> monthly reset needs
  NO cron. (When Grow subscriptions land, period_end switches to the billing
  anchor with zero schema change.)
* Top-ups form a FIFO pool (credits_total - credits_consumed) that persists
  across periods; each expires at `expires_at` (purchase + 12 months).
* A reservation consumes IMMEDIATELY (plan first, then top-ups FIFO) while
  holding the per-tenant row lock, so concurrent reservations can never
  oversell. `commit` flips the row; `release` refunds the exact allocation.
  (On sqlite FOR UPDATE is a no-op — unit tests run single-connection.)

All functions run inside the CALLER's session/transaction and emit events via
the shared session (CLAUDE.md: domain row + events row, same txn). The caller
owns the commit.

Worker duties defined elsewhere (blueprint §4): release_orphaned() at startup,
sweep stuck reservations older than STUCK_RESERVATION_HOURS.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events import emit_event
from app.models import CreditLedger, CreditTopup, Tenant

# FOUNDER DECISION PENDING (blueprint §11): placeholder monthly quotas per plan
# tier and per-operation prices. Real numbers require Higgsfield Studio actual
# per-job cost to hold the >=80% gross-margin rule.
PLAN_MONTHLY_CREDITS: dict[str, int] = {
    "trial": 30,
    "demo": 30,
    "starter": 60,     # ₪349
    "business": 150,   # ₪690
    "pro": 350,        # ₪1,290
    "founders": 100,   # ₪490 pilot
}

OPERATION_CREDITS: dict[str, int] = {
    "keyframe": 1,      # cheap still — rejection here costs ~1/10 of a video
    "scene_video": 10,  # one Higgsfield scene generation
    "remix": 5,         # provider-side remix of an existing scene
    "stitch": 0,        # local ffmpeg — free
}

TOPUP_VALIDITY_DAYS = 365
STUCK_RESERVATION_HOURS = 3


class QuotaExceeded(Exception):
    """Raised on reserve() when the tenant lacks credits.

    Carries exact numbers for the Hebrew hard-block message
    ("נדרשים X קרדיטים, יש לך Y") — Open-AI-UGC UX pattern.
    """

    def __init__(self, remaining: int, required: int):
        self.remaining = remaining
        self.required = required
        super().__init__(f"quota exceeded: need {required} credits, {remaining} remaining")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def credits_for(operation: str) -> int:
    return OPERATION_CREDITS[operation]


def current_period_end(now: datetime | None = None) -> datetime:
    """First instant of the next UTC calendar month (openshorts free_period_end)."""
    now = now or _utcnow()
    if now.month == 12:
        return datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    return datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)


def topup_expiry(now: datetime | None = None) -> datetime:
    return (now or _utcnow()) + timedelta(days=TOPUP_VALIDITY_DAYS)


async def _plan_used_this_period(
    session: AsyncSession, tenant_id, period_end: datetime
) -> int:
    total = (
        await session.execute(
            select(func.coalesce(func.sum(CreditLedger.credits_from_plan), 0)).where(
                and_(
                    CreditLedger.tenant_id == tenant_id,
                    CreditLedger.period_end == period_end,
                    CreditLedger.status.in_(("reserved", "committed")),
                )
            )
        )
    ).scalar_one()
    return int(total)


async def _topups_fifo(session: AsyncSession, tenant_id, now: datetime) -> list[CreditTopup]:
    return list(
        (
            await session.execute(
                select(CreditTopup)
                .where(
                    and_(
                        CreditTopup.tenant_id == tenant_id,
                        CreditTopup.expires_at > now,
                    )
                )
                .order_by(CreditTopup.created_at.asc(), CreditTopup.id.asc())
            )
        ).scalars()
    )


async def get_balance(
    session: AsyncSession, tenant: Tenant, now: datetime | None = None
) -> dict:
    """Read-only balance snapshot for /api/credits/balance and preflight UX."""
    now = now or _utcnow()
    period_end = current_period_end(now)
    plan_allowance = PLAN_MONTHLY_CREDITS.get(tenant.plan, 0)
    plan_used = await _plan_used_this_period(session, tenant.id, period_end)
    plan_remaining = max(0, plan_allowance - plan_used)
    topups = await _topups_fifo(session, tenant.id, now)
    topup_remaining = sum(t.credits_total - t.credits_consumed for t in topups)
    return {
        "plan": tenant.plan,
        "plan_allowance": plan_allowance,
        "plan_used": plan_used,
        "plan_remaining": plan_remaining,
        "topup_remaining": topup_remaining,
        "remaining": plan_remaining + topup_remaining,
        "period_end": period_end,
        "_topups": topups,
    }


async def grant_topup(
    session: AsyncSession,
    *,
    tenant_id,
    credits: int,
    source: str = "purchase",
    now: datetime | None = None,
) -> CreditTopup:
    """Add a prepaid credit pack (payment webhook / founders grant / seed)."""
    topup = CreditTopup(
        tenant_id=tenant_id,
        credits_total=credits,
        credits_consumed=0,
        expires_at=topup_expiry(now),
        source=source,
    )
    session.add(topup)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="system",
        actor_id="credits",
        verb="credits.topup_granted",
        entity_type="credit_topup",
        entity_id=topup.id,
        payload={"credits": credits, "source": source},
    )
    return topup


async def reserve(
    session: AsyncSession,
    *,
    tenant_id,
    operation: str,
    credits: int | None = None,
    job_id=None,
    scene_id=None,
    now: datetime | None = None,
) -> CreditLedger:
    """Atomically reserve credits for one operation. Raises QuotaExceeded.

    Consumes plan first, then top-ups FIFO — all while holding the tenant row
    lock so a parallel reserve can't read the same balance.
    """
    now = now or _utcnow()
    amount = credits if credits is not None else credits_for(operation)

    # Per-tenant serialization point (SELECT ... FOR UPDATE; no-op on sqlite).
    tenant = (
        await session.execute(
            select(Tenant).where(Tenant.id == tenant_id).with_for_update()
        )
    ).scalar_one()

    b = await get_balance(session, tenant, now)
    if amount > b["remaining"]:
        raise QuotaExceeded(remaining=b["remaining"], required=amount)

    from_plan = min(amount, b["plan_remaining"])
    from_topup = amount - from_plan

    allocations: list[dict] = []
    need = from_topup
    for t in b["_topups"]:
        if need <= 0:
            break
        available = t.credits_total - t.credits_consumed
        if available <= 0:
            continue
        take = min(available, need)
        t.credits_consumed += take
        allocations.append({"topup_id": str(t.id), "credits": take})
        need -= take

    row = CreditLedger(
        tenant_id=tenant_id,
        job_id=job_id,
        scene_id=scene_id,
        operation=operation,
        credits=amount,
        credits_from_plan=from_plan,
        credits_from_topup=from_topup,
        topup_allocations=allocations or None,
        status="reserved",
        period_end=b["period_end"],
    )
    session.add(row)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="system",
        actor_id="credits",
        verb="credits.reserved",
        entity_type="credit_ledger",
        entity_id=row.id,
        payload={"operation": operation, "credits": amount, "job_id": str(job_id) if job_id else None},
    )
    return row


async def commit_reservation(
    session: AsyncSession,
    ledger_id,
    *,
    provider_cost_usd_micros: int | None = None,
) -> bool:
    """Flip reserved -> committed (consumption already happened at reserve).

    `provider_cost_usd_micros` is the reconciled ACTUAL upstream cost
    (OpenMontage reconcile step) — margin tracking, not accounting.
    Idempotent: returns False if the row is not in `reserved`.
    """
    row = await session.get(CreditLedger, ledger_id)
    if row is None or row.status != "reserved":
        return False
    row.status = "committed"
    if provider_cost_usd_micros is not None:
        row.provider_cost_usd_micros = provider_cost_usd_micros
    await emit_event(
        session,
        tenant_id=row.tenant_id,
        actor_type="system",
        actor_id="credits",
        verb="credits.committed",
        entity_type="credit_ledger",
        entity_id=row.id,
        payload={"operation": row.operation, "credits": row.credits},
    )
    return True


async def release_reservation(session: AsyncSession, ledger_id) -> bool:
    """Refund a reservation exactly (provider failure -> house absorbs the cost).

    Plan portion refunds implicitly: a `released` row stops counting in
    _plan_used_this_period. Top-up portions refund via the recorded allocation.
    Idempotent: returns False if the row is not in `reserved`.
    """
    row = await session.get(CreditLedger, ledger_id)
    if row is None or row.status != "reserved":
        return False
    # Re-acquire the tenant lock: refunds mutate topups concurrently with reserves.
    await session.execute(
        select(Tenant.id).where(Tenant.id == row.tenant_id).with_for_update()
    )
    for alloc in row.topup_allocations or []:
        topup = await session.get(CreditTopup, uuid.UUID(alloc["topup_id"]))
        if topup is not None:
            topup.credits_consumed = max(0, topup.credits_consumed - alloc["credits"])
    row.status = "released"
    await emit_event(
        session,
        tenant_id=row.tenant_id,
        actor_type="system",
        actor_id="credits",
        verb="credits.released",
        entity_type="credit_ledger",
        entity_id=row.id,
        payload={"operation": row.operation, "credits": row.credits},
    )
    return True


async def release_stuck_reservations(
    session: AsyncSession, *, older_than_hours: int = STUCK_RESERVATION_HOURS
) -> int:
    """Sweeper: release reservations stuck past the deadline (crashed workers).

    Called from the worker loop / startup (blueprint §4); openshorts pattern.
    """
    cutoff = _utcnow() - timedelta(hours=older_than_hours)
    ids = list(
        (
            await session.execute(
                select(CreditLedger.id).where(
                    and_(
                        CreditLedger.status == "reserved",
                        CreditLedger.created_at < cutoff,
                    )
                )
            )
        ).scalars()
    )
    released = 0
    for ledger_id in ids:
        if await release_reservation(session, ledger_id):
            released += 1
    return released
