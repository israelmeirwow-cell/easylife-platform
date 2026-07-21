"""Leads API: list + PATCH stage (emits lead.stage_changed)."""

import uuid

from sqlalchemy import select

from app.models import Contact, Event, Lead


async def _make_lead(session, tenant_id, stage="new", value_agorot=25900):
    contact = Contact(tenant_id=tenant_id, name="דוד לוי", phones=["+972522222222"])
    session.add(contact)
    await session.flush()
    lead = Lead(
        tenant_id=tenant_id,
        contact_id=contact.id,
        stage=stage,
        value_agorot=value_agorot,
        source_channel="whatsapp",
    )
    session.add(lead)
    await session.commit()
    return lead


async def test_list_leads(client, session, demo_tenant):
    await _make_lead(session, demo_tenant.id)
    response = await client.get("/api/leads")
    assert response.status_code == 200
    leads = response.json()
    assert len(leads) == 1
    assert leads[0]["stage"] == "new"
    assert leads[0]["value_agorot"] == 25900


async def test_list_leads_stage_filter(client, session, demo_tenant):
    await _make_lead(session, demo_tenant.id, stage="new")
    await _make_lead(session, demo_tenant.id, stage="won")

    response = await client.get("/api/leads", params={"stage": "won"})
    assert response.status_code == 200
    leads = response.json()
    assert len(leads) == 1
    assert leads[0]["stage"] == "won"


async def test_patch_stage_emits_event(client, session, demo_tenant):
    lead = await _make_lead(session, demo_tenant.id, stage="new")

    response = await client.patch(f"/api/leads/{lead.id}", json={"stage": "qualified"})
    assert response.status_code == 200
    assert response.json()["stage"] == "qualified"

    stored = (
        await session.execute(select(Event).where(Event.verb == "lead.stage_changed"))
    ).scalars().all()
    assert len(stored) == 1
    assert stored[0].payload["from"] == "new"
    assert stored[0].payload["to"] == "qualified"
    assert stored[0].entity_id == str(lead.id)
    assert stored[0].tenant_id == demo_tenant.id


async def test_patch_same_stage_is_noop(client, session, demo_tenant):
    lead = await _make_lead(session, demo_tenant.id, stage="new")
    response = await client.patch(f"/api/leads/{lead.id}", json={"stage": "new"})
    assert response.status_code == 200
    events = (
        await session.execute(select(Event).where(Event.verb == "lead.stage_changed"))
    ).scalars().all()
    assert events == []


async def test_patch_invalid_stage_rejected(client, session, demo_tenant):
    lead = await _make_lead(session, demo_tenant.id)
    response = await client.patch(f"/api/leads/{lead.id}", json={"stage": "bogus"})
    assert response.status_code == 422


async def test_patch_unknown_lead_404(client, demo_tenant):
    response = await client.patch(f"/api/leads/{uuid.uuid4()}", json={"stage": "won"})
    assert response.status_code == 404
