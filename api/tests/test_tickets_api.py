"""Tickets API: create -> list (status) -> patch (updated/status_changed) + events."""

import uuid

from sqlalchemy import select

from app.models import Event


async def _make_ticket(client, **kwargs):
    payload = {"subject": "משלוח התעכב"}
    payload.update(kwargs)
    response = await client.post("/api/tickets", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_ticket_emits_event(client, session, demo_tenant):
    ticket = await _make_ticket(client, subject="החזר כספי", priority="urgent")
    assert ticket["status"] == "new"
    assert ticket["priority"] == "urgent"

    event = (
        await session.execute(select(Event).where(Event.verb == "ticket.created"))
    ).scalars().one()
    assert event.entity_id == ticket["id"]
    assert event.tenant_id == demo_tenant.id


async def test_list_tickets_status_filter(client):
    await _make_ticket(client, status="new")
    await _make_ticket(client, status="resolved")

    resolved = await client.get("/api/tickets", params={"status": "resolved"})
    assert len(resolved.json()) == 1
    assert resolved.json()[0]["status"] == "resolved"


async def test_patch_status_emits_status_changed(client, session):
    ticket = await _make_ticket(client, status="new")
    response = await client.patch(f"/api/tickets/{ticket['id']}", json={"status": "open"})
    assert response.status_code == 200
    assert response.json()["status"] == "open"

    events = (
        await session.execute(select(Event).where(Event.verb == "ticket.status_changed"))
    ).scalars().all()
    assert len(events) == 1
    assert events[0].payload["from"] == "new"
    assert events[0].payload["to"] == "open"


async def test_patch_other_field_emits_updated(client, session):
    ticket = await _make_ticket(client, status="new")
    response = await client.patch(
        f"/api/tickets/{ticket['id']}", json={"priority": "high", "body": "עדכון"}
    )
    assert response.status_code == 200

    updated = (
        await session.execute(select(Event).where(Event.verb == "ticket.updated"))
    ).scalars().all()
    assert len(updated) == 1
    assert set(updated[0].payload["fields"]) == {"priority", "body"}
    status_changed = (
        await session.execute(select(Event).where(Event.verb == "ticket.status_changed"))
    ).scalars().all()
    assert status_changed == []


async def test_patch_unknown_ticket_404(client):
    response = await client.patch(f"/api/tickets/{uuid.uuid4()}", json={"status": "open"})
    assert response.status_code == 404
