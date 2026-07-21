"""Deals API: create -> list (stage/pipeline) -> get -> patch stage/fields + events."""

import uuid

from sqlalchemy import select

from app.models import Event


async def _make_deal(client, **kwargs):
    payload = {"title": "עסקה", "value_agorot": 250000, "stage": "lead"}
    payload.update(kwargs)
    response = await client.post("/api/deals", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_deal_emits_event(client, session, demo_tenant):
    deal = await _make_deal(client, title="הזמנת קיץ", value_agorot=3600000)
    assert deal["stage"] == "lead"
    assert deal["pipeline"] == "sales"
    assert deal["currency"] == "ILS"

    event = (
        await session.execute(select(Event).where(Event.verb == "deal.created"))
    ).scalars().one()
    assert event.entity_id == deal["id"]
    assert event.payload["value_agorot"] == 3600000
    assert event.tenant_id == demo_tenant.id


async def test_list_deals_stage_and_pipeline_filters(client):
    await _make_deal(client, stage="lead")
    await _make_deal(client, stage="won")
    await _make_deal(client, stage="won", pipeline="wholesale")

    all_deals = await client.get("/api/deals")
    assert len(all_deals.json()) == 3

    won = await client.get("/api/deals", params={"stage": "won"})
    assert len(won.json()) == 2

    wholesale = await client.get("/api/deals", params={"pipeline": "wholesale"})
    assert len(wholesale.json()) == 1
    assert wholesale.json()[0]["pipeline"] == "wholesale"


async def test_get_deal_and_404(client):
    deal = await _make_deal(client)
    got = await client.get(f"/api/deals/{deal['id']}")
    assert got.status_code == 200
    assert (await client.get(f"/api/deals/{uuid.uuid4()}")).status_code == 404


async def test_patch_stage_emits_stage_changed(client, session):
    deal = await _make_deal(client, stage="lead")
    response = await client.patch(f"/api/deals/{deal['id']}", json={"stage": "qualified"})
    assert response.status_code == 200
    assert response.json()["stage"] == "qualified"

    events = (
        await session.execute(select(Event).where(Event.verb == "deal.stage_changed"))
    ).scalars().all()
    assert len(events) == 1
    assert events[0].payload["from"] == "lead"
    assert events[0].payload["to"] == "qualified"


async def test_patch_stage_to_won_emits_won(client, session):
    deal = await _make_deal(client, stage="negotiation", value_agorot=500000)
    response = await client.patch(f"/api/deals/{deal['id']}", json={"stage": "won"})
    assert response.status_code == 200

    verbs = {
        e.verb
        for e in (await session.execute(select(Event))).scalars().all()
        if e.verb.startswith("deal.")
    }
    assert "deal.stage_changed" in verbs
    assert "deal.won" in verbs
    won = (
        await session.execute(select(Event).where(Event.verb == "deal.won"))
    ).scalars().one()
    assert won.entity_id == deal["id"]


async def test_patch_stage_to_lost_emits_lost(client, session):
    deal = await _make_deal(client, stage="proposal")
    await client.patch(f"/api/deals/{deal['id']}", json={"stage": "lost"})
    lost = (
        await session.execute(select(Event).where(Event.verb == "deal.lost"))
    ).scalars().all()
    assert len(lost) == 1


async def test_patch_non_stage_field_emits_updated(client, session):
    deal = await _make_deal(client, stage="lead", value_agorot=100000)
    response = await client.patch(
        f"/api/deals/{deal['id']}", json={"value_agorot": 200000, "title": "מעודכן"}
    )
    assert response.status_code == 200
    assert response.json()["value_agorot"] == 200000

    updated = (
        await session.execute(select(Event).where(Event.verb == "deal.updated"))
    ).scalars().all()
    assert len(updated) == 1
    assert set(updated[0].payload["fields"]) == {"value_agorot", "title"}
    # no stage change -> no stage_changed event
    stage_events = (
        await session.execute(select(Event).where(Event.verb == "deal.stage_changed"))
    ).scalars().all()
    assert stage_events == []


async def test_patch_unknown_deal_404(client):
    response = await client.patch(f"/api/deals/{uuid.uuid4()}", json={"stage": "won"})
    assert response.status_code == 404
