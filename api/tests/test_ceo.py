"""CEO agent — brief + ask, from real brain context, with tenant isolation."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.ceo.context import gather_context
from app.events import emit_event
from app.main import app
from app.models import Approval, Deal, Ticket


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_brief_shape(client):
    r = await client.get("/api/ceo/brief")
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("headline", "highlights", "risks", "recommendations", "focus_now", "source"):
        assert key in data
    assert isinstance(data["recommendations"], list)
    assert isinstance(data["focus_now"], list)


async def test_ask_returns_answer(client):
    r = await client.post("/api/ceo/ask", json={"question": "על מה להתמקד היום?"})
    assert r.status_code == 200, r.text
    assert r.json()["answer"]


async def test_ask_empty_question(client):
    r = await client.post("/api/ceo/ask", json={"question": "   "})
    assert r.status_code == 200
    assert r.json()["answer"]


async def test_context_reflects_pending_approvals(session, demo_tenant):
    tid = demo_tenant.id
    # pending approval + a closeable deal + an urgent ticket
    session.add(Approval(
        tenant_id=tid, requested_by_agent="whatsapp", action_type="refund",
        payload={}, preview_text="לאשר החזר", status="pending",
    ))
    session.add(Deal(
        tenant_id=tid, title="עסקה בשלה", stage="negotiation",
        value_agorot=500000, currency="ILS", pipeline="sales",
    ))
    session.add(Ticket(tenant_id=tid, subject="תקלה", status="open", priority="urgent"))
    await session.flush()
    await emit_event(
        session, tenant_id=tid, actor_type="system", actor_id="t",
        verb="message.received", entity_type="conversation", entity_id=uuid.uuid4(),
        payload={},
    )
    await session.commit()

    ctx = await gather_context(session, tid)
    assert len(ctx.pending_approvals) >= 1
    assert ctx.open_deals_count >= 1
    assert any(t["priority"] == "urgent" for t in ctx.urgent_tickets)
    assert ctx.pipeline_value_agorot >= 500000
