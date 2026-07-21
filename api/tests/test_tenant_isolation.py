"""THE sacred test: cross-tenant isolation.

Two tenants (registered through the real auth flow). Tenant A's session must
never read or mutate tenant B's contacts, leads, conversations, approvals or
events. These tests block deploy on failure.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.events import emit_event
from app.main import app
from app.models import Approval, Contact, Lead


async def _register_and_login(email: str, business_name: str) -> tuple[AsyncClient, str]:
    """Returns an authenticated client (own cookie jar) + its tenant_id."""
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    register = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "sisma1234!", "business_name": business_name},
    )
    assert register.status_code == 201, register.text
    tenant_id = register.json()["tenant_id"]

    login = await client.post(
        "/api/auth/login", data={"username": email, "password": "sisma1234!"}
    )
    assert login.status_code in (200, 204), login.text
    assert "easylife_auth" in login.cookies or client.cookies.get("easylife_auth")
    return client, tenant_id


@pytest.fixture
async def two_tenants(session):
    client_a, tenant_a = await _register_and_login("a@aleph.co.il", "מספרת אלף")
    client_b, tenant_b = await _register_and_login("b@bet.co.il", "בית קפה בית")

    data = {}
    for key, tenant_id_str in (("a", tenant_a), ("b", tenant_b)):
        tenant_id = uuid.UUID(tenant_id_str)
        contact = Contact(tenant_id=tenant_id, name=f"לקוח {key}", phones=[f"+97252{key}"])
        session.add(contact)
        await session.flush()
        lead = Lead(tenant_id=tenant_id, contact_id=contact.id, value_agorot=10000)
        approval = Approval(
            tenant_id=tenant_id,
            requested_by_agent="whatsapp_support",
            action_type="refund",
            payload={},
            preview_text=f"אישור {key}",
        )
        session.add_all([lead, approval])
        await session.flush()
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="system",
            actor_id="test",
            verb="contact.created",
            entity_type="contact",
            entity_id=contact.id,
            payload={"name": contact.name},
        )
        data[key] = {"contact": contact, "lead": lead, "approval": approval}
    await session.commit()

    yield {
        "client_a": client_a,
        "client_b": client_b,
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        **data,
    }
    await client_a.aclose()
    await client_b.aclose()


async def test_registration_creates_separate_tenants(two_tenants):
    assert two_tenants["tenant_a"] != two_tenants["tenant_b"]


async def test_me_reports_own_tenant(two_tenants):
    me_a = await two_tenants["client_a"].get("/api/auth/me")
    assert me_a.status_code == 200
    assert me_a.json()["tenant_id"] == two_tenants["tenant_a"]
    assert me_a.json()["role"] == "owner"


async def test_contacts_are_isolated(two_tenants):
    client_a = two_tenants["client_a"]
    b_contact = two_tenants["b"]["contact"]

    listing = await client_a.get("/api/contacts")
    assert listing.status_code == 200
    ids = {c["id"] for c in listing.json()}
    assert str(two_tenants["a"]["contact"].id) in ids
    assert str(b_contact.id) not in ids

    direct = await client_a.get(f"/api/contacts/{b_contact.id}")
    assert direct.status_code == 404

    timeline = await client_a.get(f"/api/contacts/{b_contact.id}/timeline")
    assert timeline.status_code == 404


async def test_leads_are_isolated(two_tenants):
    client_a = two_tenants["client_a"]
    b_lead = two_tenants["b"]["lead"]

    listing = await client_a.get("/api/leads")
    ids = {lead["id"] for lead in listing.json()}
    assert str(two_tenants["a"]["lead"].id) in ids
    assert str(b_lead.id) not in ids

    # A must not be able to mutate B's lead
    patch = await client_a.patch(f"/api/leads/{b_lead.id}", json={"stage": "won"})
    assert patch.status_code == 404


async def test_events_feed_is_isolated(two_tenants):
    feed_a = await two_tenants["client_a"].get("/api/feed")
    assert feed_a.status_code == 200
    tenants_seen = {event["tenant_id"] for event in feed_a.json()}
    assert tenants_seen == {two_tenants["tenant_a"]}

    feed_b = await two_tenants["client_b"].get("/api/feed")
    tenants_seen_b = {event["tenant_id"] for event in feed_b.json()}
    assert tenants_seen_b == {two_tenants["tenant_b"]}


async def test_approvals_are_isolated(two_tenants):
    client_a = two_tenants["client_a"]
    b_approval = two_tenants["b"]["approval"]

    listing = await client_a.get("/api/approvals")
    ids = {a["id"] for a in listing.json()}
    assert str(b_approval.id) not in ids

    # A must not be able to decide B's approval
    decide = await client_a.post(
        f"/api/approvals/{b_approval.id}/decide", json={"decision": "approve"}
    )
    assert decide.status_code == 404
