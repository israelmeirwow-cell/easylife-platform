"""emit_event: same-transaction insert + post-commit EventBus publish."""

import asyncio

from sqlalchemy import select

from app.events import emit_event, event_bus
from app.models import Event, Tenant


async def _make_tenant(session, name="עסק לדוגמה"):
    tenant = Tenant(name=name)
    session.add(tenant)
    await session.flush()
    return tenant


async def test_emit_event_writes_row_in_caller_transaction(session):
    tenant = await _make_tenant(session)
    event = await emit_event(
        session,
        tenant_id=tenant.id,
        actor_type="agent",
        actor_id="whatsapp_support",
        verb="message.received",
        entity_type="message",
        entity_id="abc",
        payload={"body": "שלום"},
    )
    assert event.id is not None  # assigned by flush, before commit
    await session.commit()

    stored = (await session.execute(select(Event))).scalars().one()
    assert stored.verb == "message.received"
    assert stored.actor_type == "agent"
    assert stored.payload == {"body": "שלום"}
    assert stored.tenant_id == tenant.id


async def test_subscriber_receives_after_commit(session):
    tenant = await _make_tenant(session)
    await session.commit()

    subscription = event_bus.subscribe(str(tenant.id))
    try:
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id="tester",
            verb="lead.stage_changed",
            entity_type="lead",
            entity_id="l1",
            payload={"from": "new", "to": "won"},
        )
        # Not published yet — commit publishes.
        assert event_bus.subscriber_count(str(tenant.id)) == 1
        await session.commit()

        received = await asyncio.wait_for(subscription.__anext__(), timeout=2)
        assert received["verb"] == "lead.stage_changed"
        assert received["payload"] == {"from": "new", "to": "won"}
        assert received["tenant_id"] == str(tenant.id)
    finally:
        await subscription.aclose()
    assert event_bus.subscriber_count(str(tenant.id)) == 0


async def test_rollback_publishes_nothing(session):
    tenant = await _make_tenant(session)
    await session.commit()

    subscription = event_bus.subscribe(str(tenant.id))
    try:
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="system",
            actor_id=None,
            verb="approval.requested",
            entity_type="approval",
            entity_id=None,
            payload={},
        )
        await session.rollback()
        await session.commit()  # commit after rollback must not publish dropped events

        with_timeout = asyncio.wait_for(subscription.__anext__(), timeout=0.2)
        try:
            await with_timeout
            raise AssertionError("event published despite rollback")
        except asyncio.TimeoutError:
            pass
    finally:
        await subscription.aclose()


async def test_events_only_reach_their_tenant(session):
    tenant_a = await _make_tenant(session, "A")
    tenant_b = await _make_tenant(session, "B")
    await session.commit()

    sub_b = event_bus.subscribe(str(tenant_b.id))
    try:
        await emit_event(
            session,
            tenant_id=tenant_a.id,
            actor_type="system",
            actor_id="seed",
            verb="contact.created",
            entity_type="contact",
            entity_id="c1",
            payload={},
        )
        await session.commit()

        try:
            await asyncio.wait_for(sub_b.__anext__(), timeout=0.2)
            raise AssertionError("tenant B received tenant A's event")
        except asyncio.TimeoutError:
            pass
    finally:
        await sub_b.aclose()
