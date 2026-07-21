"""Feed API against the app with the dev-fallback demo tenant."""

from app.events import emit_event
from app.models import Contact


async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_feed_empty_creates_demo_tenant(client):
    response = await client.get("/api/feed")
    assert response.status_code == 200
    assert response.json() == []


async def test_feed_returns_recent_events_desc(client, session, demo_tenant):
    for i in range(3):
        await emit_event(
            session,
            tenant_id=demo_tenant.id,
            actor_type="system",
            actor_id="test",
            verb="message.received",
            entity_type="message",
            entity_id=str(i),
            payload={"n": i},
        )
    await session.commit()

    response = await client.get("/api/feed")
    assert response.status_code == 200
    events = response.json()
    assert len(events) == 3
    # Most recent first
    assert [e["payload"]["n"] for e in events] == [2, 1, 0]
    assert events[0]["verb"] == "message.received"
    assert events[0]["tenant_id"] == str(demo_tenant.id)


async def test_feed_limit(client, session, demo_tenant):
    for i in range(10):
        await emit_event(
            session,
            tenant_id=demo_tenant.id,
            actor_type="system",
            actor_id="test",
            verb="lead.seen",
            entity_type="lead",
            entity_id=str(i),
            payload={},
        )
    await session.commit()

    response = await client.get("/api/feed", params={"limit": 4})
    assert response.status_code == 200
    assert len(response.json()) == 4


async def test_contact_timeline(client, session, demo_tenant):
    contact = Contact(tenant_id=demo_tenant.id, name="שרה כהן", phones=["+972521111111"])
    session.add(contact)
    await session.flush()
    await emit_event(
        session,
        tenant_id=demo_tenant.id,
        actor_type="system",
        actor_id="connector",
        verb="contact.created",
        entity_type="contact",
        entity_id=contact.id,
        payload={"name": contact.name},
    )
    await emit_event(
        session,
        tenant_id=demo_tenant.id,
        actor_type="contact",
        actor_id=str(contact.id),
        verb="message.received",
        entity_type="message",
        entity_id="m1",
        payload={"contact_id": str(contact.id), "body": "שלום"},
    )
    # Unrelated event must NOT appear in the timeline
    await emit_event(
        session,
        tenant_id=demo_tenant.id,
        actor_type="system",
        actor_id="x",
        verb="lead.seen",
        entity_type="lead",
        entity_id="other",
        payload={},
    )
    await session.commit()

    response = await client.get(f"/api/contacts/{contact.id}/timeline")
    assert response.status_code == 200
    verbs = [e["verb"] for e in response.json()]
    assert verbs == ["message.received", "contact.created"]
