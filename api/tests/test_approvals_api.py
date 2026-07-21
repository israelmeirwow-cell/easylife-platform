"""Approvals inbox: list pending + decide state machine."""

from sqlalchemy import select

from app.models import Approval, Event


async def _make_approval(session, tenant_id, status="pending"):
    approval = Approval(
        tenant_id=tenant_id,
        requested_by_agent="whatsapp_support",
        action_type="refund",
        payload={"amount_agorot": 18900},
        preview_text="לאשר החזר כספי של ‏189 ₪?",
        status=status,
    )
    session.add(approval)
    await session.commit()
    return approval


async def test_list_pending(client, session, demo_tenant):
    await _make_approval(session, demo_tenant.id)
    await _make_approval(session, demo_tenant.id, status="rejected")

    response = await client.get("/api/approvals")
    assert response.status_code == 200
    approvals = response.json()
    assert len(approvals) == 1
    assert approvals[0]["status"] == "pending"


async def test_approve_emits_event(client, session, demo_tenant):
    approval = await _make_approval(session, demo_tenant.id)

    response = await client.post(
        f"/api/approvals/{approval.id}/decide", json={"decision": "approve"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["decided_at"] is not None

    event = (
        await session.execute(select(Event).where(Event.verb == "approval.decided"))
    ).scalars().one()
    assert event.payload["decision"] == "approve"
    assert event.entity_id == str(approval.id)


async def test_reject(client, session, demo_tenant):
    approval = await _make_approval(session, demo_tenant.id)
    response = await client.post(
        f"/api/approvals/{approval.id}/decide", json={"decision": "reject"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


async def test_decide_twice_conflicts(client, session, demo_tenant):
    """State machine: only pending can be approved/rejected."""
    approval = await _make_approval(session, demo_tenant.id)
    first = await client.post(f"/api/approvals/{approval.id}/decide", json={"decision": "approve"})
    assert first.status_code == 200
    second = await client.post(f"/api/approvals/{approval.id}/decide", json={"decision": "reject"})
    assert second.status_code == 409


async def test_decide_invalid_decision(client, session, demo_tenant):
    approval = await _make_approval(session, demo_tenant.id)
    response = await client.post(f"/api/approvals/{approval.id}/decide", json={"decision": "maybe"})
    assert response.status_code == 422
