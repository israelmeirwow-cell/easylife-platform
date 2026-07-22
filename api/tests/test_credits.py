"""Credit engine tests: reserve/commit/release, hybrid quota, tenant isolation.

The money-critical module — test-first discipline (blueprint §9 day 2).
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.credits import engine
from app.credits.engine import (
    QuotaExceeded,
    commit_reservation,
    current_period_end,
    get_balance,
    grant_topup,
    release_reservation,
    release_stuck_reservations,
    reserve,
)
from app.models import CreditLedger, CreditTopup, Event, Tenant


@pytest.fixture
async def tenant(session):
    t = Tenant(name="עסק בדיקה", plan="starter")  # starter => 60 plan credits
    session.add(t)
    await session.commit()
    return t


@pytest.fixture
async def other_tenant(session):
    t = Tenant(name="עסק אחר", plan="starter")
    session.add(t)
    await session.commit()
    return t


async def test_balance_fresh_tenant(session, tenant):
    b = await get_balance(session, tenant)
    assert b["plan_allowance"] == 60
    assert b["plan_used"] == 0
    assert b["topup_remaining"] == 0
    assert b["remaining"] == 60


async def test_reserve_consumes_plan_first(session, tenant):
    await grant_topup(session, tenant_id=tenant.id, credits=100)
    row = await reserve(session, tenant_id=tenant.id, operation="scene_video")
    await session.commit()
    assert row.credits == 10
    assert row.credits_from_plan == 10
    assert row.credits_from_topup == 0
    b = await get_balance(session, tenant)
    assert b["plan_remaining"] == 50
    assert b["topup_remaining"] == 100


async def test_reserve_spills_into_topups_fifo(session, tenant):
    first = await grant_topup(session, tenant_id=tenant.id, credits=5)
    second = await grant_topup(session, tenant_id=tenant.id, credits=50)
    # Drain the 60 plan credits, then 8 more: 5 from first topup, 3 from second.
    await reserve(session, tenant_id=tenant.id, operation="scene_video", credits=60)
    row = await reserve(session, tenant_id=tenant.id, operation="scene_video", credits=8)
    await session.commit()
    assert row.credits_from_plan == 0
    assert row.credits_from_topup == 8
    assert row.topup_allocations == [
        {"topup_id": str(first.id), "credits": 5},
        {"topup_id": str(second.id), "credits": 3},
    ]
    await session.refresh(first)
    await session.refresh(second)
    assert first.credits_consumed == 5
    assert second.credits_consumed == 3


async def test_reserve_blocks_with_exact_shortfall(session, tenant):
    with pytest.raises(QuotaExceeded) as exc:
        await reserve(session, tenant_id=tenant.id, operation="scene_video", credits=1000)
    assert exc.value.required == 1000
    assert exc.value.remaining == 60


async def test_release_refunds_exactly(session, tenant):
    topup = await grant_topup(session, tenant_id=tenant.id, credits=20)
    row = await reserve(session, tenant_id=tenant.id, operation="scene_video", credits=70)
    await session.commit()
    assert row.credits_from_topup == 10

    assert await release_reservation(session, row.id) is True
    await session.commit()

    await session.refresh(topup)
    assert topup.credits_consumed == 0
    b = await get_balance(session, tenant)
    # Released plan portion stops counting automatically (period-tag accounting).
    assert b["plan_remaining"] == 60
    assert b["remaining"] == 80


async def test_commit_is_final_and_idempotent(session, tenant):
    row = await reserve(session, tenant_id=tenant.id, operation="keyframe")
    await session.commit()
    assert await commit_reservation(session, row.id, provider_cost_usd_micros=42_000) is True
    await session.commit()
    # Second commit and a late release are both no-ops.
    assert await commit_reservation(session, row.id) is False
    assert await release_reservation(session, row.id) is False
    await session.refresh(row)
    assert row.status == "committed"
    assert row.provider_cost_usd_micros == 42_000
    b = await get_balance(session, tenant)
    assert b["plan_used"] == 1


async def test_plan_quota_resets_next_period_without_cron(session, tenant):
    row = await reserve(session, tenant_id=tenant.id, operation="scene_video", credits=60)
    await commit_reservation(session, row.id)
    await session.commit()
    assert (await get_balance(session, tenant))["plan_remaining"] == 0

    # Next month: the old rows carry the old period tag and stop counting.
    next_month = current_period_end() + timedelta(seconds=1)
    b = await get_balance(session, tenant, now=next_month)
    assert b["plan_remaining"] == 60


async def test_expired_topups_do_not_count(session, tenant):
    topup = await grant_topup(session, tenant_id=tenant.id, credits=50)
    topup.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    await session.commit()
    b = await get_balance(session, tenant)
    assert b["topup_remaining"] == 0
    with pytest.raises(QuotaExceeded):
        await reserve(session, tenant_id=tenant.id, operation="scene_video", credits=61)


async def test_stuck_reservation_sweeper(session, tenant):
    row = await reserve(session, tenant_id=tenant.id, operation="scene_video")
    await session.commit()
    # Backdate past the deadline, then sweep.
    row.created_at = datetime.now(timezone.utc) - timedelta(hours=4)
    await session.commit()
    assert await release_stuck_reservations(session) == 1
    await session.commit()
    assert (await get_balance(session, tenant))["plan_remaining"] == 60


async def test_credit_events_emitted_same_transaction(session, tenant):
    await grant_topup(session, tenant_id=tenant.id, credits=10)
    row = await reserve(session, tenant_id=tenant.id, operation="keyframe")
    await commit_reservation(session, row.id)
    await session.commit()
    verbs = [
        e.verb
        for e in (
            (await session.execute(select(Event).where(Event.tenant_id == tenant.id))).scalars()
        )
    ]
    assert "credits.topup_granted" in verbs
    assert "credits.reserved" in verbs
    assert "credits.committed" in verbs


async def test_tenant_isolation_credits(session, tenant, other_tenant):
    """Sacred: tenant B's spend must never touch tenant A's balance."""
    await grant_topup(session, tenant_id=tenant.id, credits=100)
    await reserve(session, tenant_id=other_tenant.id, operation="scene_video", credits=60)
    await session.commit()

    a = await get_balance(session, tenant)
    b = await get_balance(session, other_tenant)
    assert a["remaining"] == 160          # untouched
    assert b["remaining"] == 0            # fully drained
    ledger_tenants = {
        row.tenant_id
        for row in (await session.execute(select(CreditLedger))).scalars()
    }
    assert other_tenant.id in ledger_tenants
    topup_tenants = {
        row.tenant_id
        for row in (await session.execute(select(CreditTopup))).scalars()
    }
    assert topup_tenants == {tenant.id}


async def test_operation_price_table(session, tenant):
    assert engine.credits_for("keyframe") == 1
    assert engine.credits_for("scene_video") == 10
    assert engine.credits_for("stitch") == 0
    row = await reserve(session, tenant_id=tenant.id, operation="stitch")
    await session.commit()
    assert row.credits == 0  # free operations still leave an audit row
