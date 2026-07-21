"""Activities API: create (activity.logged) + list filtered by contact/account/deal."""

import uuid

from sqlalchemy import select

from app.models import Event


async def test_create_activity_emits_event(client, session, demo_tenant):
    response = await client.post(
        "/api/activities",
        json={"kind": "call", "body": "שיחת מכירה עם הבוטיק"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["kind"] == "call"
    assert body["occurred_at"] is not None

    event = (
        await session.execute(select(Event).where(Event.verb == "activity.logged"))
    ).scalars().one()
    assert event.entity_id == body["id"]
    assert event.payload["kind"] == "call"
    assert event.tenant_id == demo_tenant.id


async def test_list_activities_filtered(client):
    contact_id = str(uuid.uuid4())
    account_id = str(uuid.uuid4())
    deal_id = str(uuid.uuid4())

    await client.post(
        "/api/activities", json={"kind": "note", "body": "לפי איש קשר", "contact_id": contact_id}
    )
    await client.post(
        "/api/activities", json={"kind": "note", "body": "לפי חשבון", "account_id": account_id}
    )
    await client.post(
        "/api/activities", json={"kind": "note", "body": "לפי עסקה", "deal_id": deal_id}
    )

    all_acts = await client.get("/api/activities")
    assert len(all_acts.json()) == 3

    by_contact = await client.get("/api/activities", params={"contact_id": contact_id})
    assert len(by_contact.json()) == 1
    assert by_contact.json()[0]["contact_id"] == contact_id

    by_account = await client.get("/api/activities", params={"account_id": account_id})
    assert len(by_account.json()) == 1
    assert by_account.json()[0]["account_id"] == account_id

    by_deal = await client.get("/api/activities", params={"deal_id": deal_id})
    assert len(by_deal.json()) == 1
    assert by_deal.json()[0]["deal_id"] == deal_id


async def test_create_activity_invalid_kind_rejected(client):
    response = await client.post("/api/activities", json={"kind": "smoke", "body": "x"})
    assert response.status_code == 422
