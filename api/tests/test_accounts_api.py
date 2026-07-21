"""Accounts API: create -> list (search) -> get -> patch -> timeline + events."""

import uuid

from sqlalchemy import select

from app.events import emit_event
from app.models import Deal, Event


async def test_create_account_emits_event(client, session, demo_tenant):
    response = await client.post(
        "/api/accounts",
        json={"name": "בוטיק לובלי", "kind": "business", "phone": "+97286221100"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "בוטיק לובלי"
    assert body["kind"] == "business"

    event = (
        await session.execute(select(Event).where(Event.verb == "account.created"))
    ).scalars().one()
    assert event.entity_id == body["id"]
    assert event.tenant_id == demo_tenant.id
    assert event.payload["name"] == "בוטיק לובלי"


async def test_list_and_search_accounts(client):
    await client.post("/api/accounts", json={"name": "רשת סטייל", "email": "a@style.co.il"})
    await client.post("/api/accounts", json={"name": "דניז קולקשן", "email": "b@deniz.co.il"})

    listing = await client.get("/api/accounts")
    assert listing.status_code == 200
    assert len(listing.json()) == 2

    search = await client.get("/api/accounts", params={"q": "דניז"})
    assert search.status_code == 200
    names = [a["name"] for a in search.json()]
    assert names == ["דניז קולקשן"]

    by_email = await client.get("/api/accounts", params={"q": "style.co.il"})
    assert [a["name"] for a in by_email.json()] == ["רשת סטייל"]


async def test_get_account(client):
    created = (await client.post("/api/accounts", json={"name": "חנות רוני"})).json()
    got = await client.get(f"/api/accounts/{created['id']}")
    assert got.status_code == 200
    assert got.json()["name"] == "חנות רוני"

    missing = await client.get(f"/api/accounts/{uuid.uuid4()}")
    assert missing.status_code == 404


async def test_patch_account_emits_update_event(client, session):
    created = (await client.post("/api/accounts", json={"name": "אאוטלט"})).json()
    response = await client.patch(
        f"/api/accounts/{created['id']}",
        json={"industry": "אאוטלט", "tags": ["מחיר"]},
    )
    assert response.status_code == 200
    assert response.json()["industry"] == "אאוטלט"
    assert response.json()["tags"] == ["מחיר"]

    event = (
        await session.execute(select(Event).where(Event.verb == "account.updated"))
    ).scalars().one()
    assert set(event.payload["fields"]) == {"industry", "tags"}


async def test_account_timeline_includes_account_and_its_deals(client, session, demo_tenant):
    account = (await client.post("/api/accounts", json={"name": "בוטיק"})).json()
    account_id = uuid.UUID(account["id"])

    # A deal for this account (emits deal.created carrying account_id).
    deal = (
        await client.post(
            "/api/deals",
            json={"title": "עסקה", "account_id": account["id"], "value_agorot": 100000},
        )
    ).json()

    # An unrelated event must not show up.
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

    timeline = await client.get(f"/api/accounts/{account['id']}/timeline")
    assert timeline.status_code == 200
    verbs = {e["verb"] for e in timeline.json()}
    assert "account.created" in verbs
    assert "deal.created" in verbs
    assert "lead.seen" not in verbs

    # sanity: the deal really belongs to the account
    stored_deal = (
        await session.execute(select(Deal).where(Deal.id == uuid.UUID(deal["id"])))
    ).scalars().one()
    assert stored_deal.account_id == account_id
