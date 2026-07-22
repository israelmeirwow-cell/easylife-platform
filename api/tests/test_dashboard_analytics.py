"""/api/dashboard/analytics — rich business aggregates, tenant-scoped."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.events import emit_event
from app.models import Activity, Deal, Lead, Contact, Tenant, Ticket


@pytest.fixture
async def seeded(session, demo_tenant):
    """A small but full business picture for the demo tenant + a rival tenant."""
    t = demo_tenant
    now = datetime.now(timezone.utc)

    contact = Contact(tenant_id=t.id, name="לקוח בדיקה")
    session.add(contact)
    await session.flush()

    deals = [
        Deal(tenant_id=t.id, title="עסקה גדולה", stage="proposal", value_agorot=500_000),
        Deal(tenant_id=t.id, title="עסקה קטנה", stage="lead", value_agorot=50_000),
        Deal(tenant_id=t.id, title="נסגרה", stage="won", value_agorot=200_000),
        Deal(tenant_id=t.id, title="אבודה", stage="lost", value_agorot=90_000),
    ]
    session.add_all(deals)
    await session.flush()
    await emit_event(
        session,
        tenant_id=t.id,
        actor_type="agent",
        actor_id="crm",
        verb="deal.won",
        entity_type="deal",
        entity_id=deals[2].id,
    )

    session.add_all(
        [
            Lead(tenant_id=t.id, contact_id=contact.id, stage="new"),
            Lead(tenant_id=t.id, contact_id=contact.id, stage="new"),
            Lead(tenant_id=t.id, contact_id=contact.id, stage="qualified"),
            Ticket(tenant_id=t.id, subject="תקלה", status="open"),
            Activity(tenant_id=t.id, kind="call", body="שיחה", occurred_at=now - timedelta(days=1)),
            Activity(tenant_id=t.id, kind="note", body="הערה", occurred_at=now - timedelta(days=1)),
        ]
    )

    # rival tenant data must never leak in
    rival = Tenant(name="עסק מתחרה", plan="starter")
    session.add(rival)
    await session.flush()
    session.add(Deal(tenant_id=rival.id, title="זר", stage="won", value_agorot=9_999_999))
    await session.commit()
    return t


async def test_analytics_shape_and_math(client, seeded):
    r = await client.get("/api/dashboard/analytics")
    assert r.status_code == 200
    data = r.json()

    assert len(data["monthly"]) == 6
    this_month = data["monthly"][-1]
    assert this_month["created_count"] == 4
    assert this_month["won_count"] == 1
    assert this_month["won_agorot"] == 200_000

    funnel = {b["key"]: b["count"] for b in data["leads_funnel"]}
    assert funnel["new"] == 2 and funnel["qualified"] == 1

    tickets = {b["key"]: b["count"] for b in data["tickets_by_status"]}
    assert tickets["open"] == 1

    assert sum(b["count"] for b in data["activity_by_weekday"]) == 2

    top = data["top_open_deals"]
    assert top[0]["title"] == "עסקה גדולה" and top[0]["value_agorot"] == 500_000
    # closed deals (won/lost) are not "open"
    assert all(d["stage"] not in ("won", "lost") for d in top)

    assert data["won_total_agorot"] == 200_000
    assert data["avg_deal_agorot"] == 200_000
    assert data["win_rate_pct"] == 50.0  # 1 won / (1 won + 1 lost)


async def test_analytics_tenant_isolation(client, seeded):
    """The rival tenant's ₪99,999.99 deal must not appear anywhere."""
    r = await client.get("/api/dashboard/analytics")
    data = r.json()
    assert data["won_total_agorot"] == 200_000
    assert all(d["value_agorot"] != 9_999_999 for d in data["top_open_deals"])


async def test_analytics_empty_tenant(client, demo_tenant):
    r = await client.get("/api/dashboard/analytics")
    assert r.status_code == 200
    data = r.json()
    assert len(data["monthly"]) == 6
    assert data["win_rate_pct"] == 0.0
    assert data["top_open_deals"] == []
