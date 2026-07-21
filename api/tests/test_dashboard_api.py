"""Dashboard summary: counters + pipeline math over deals/leads/tasks/tickets."""

from app.models import Contact, Deal, Lead, Task, Ticket


async def _seed_dashboard(session, tenant_id):
    # Contacts: 3
    for i in range(3):
        session.add(Contact(tenant_id=tenant_id, name=f"c{i}", phones=[f"+9725{i}"]))

    # Leads: 2 new (leads_count), 1 won (not counted)
    contact = Contact(tenant_id=tenant_id, name="lead-contact", phones=["+9720"])
    session.add(contact)
    await session.flush()
    session.add_all(
        [
            Lead(tenant_id=tenant_id, contact_id=contact.id, stage="new", value_agorot=100),
            Lead(tenant_id=tenant_id, contact_id=contact.id, stage="new", value_agorot=200),
            Lead(tenant_id=tenant_id, contact_id=contact.id, stage="won", value_agorot=999),
        ]
    )

    # Deals: open (lead/qualified/proposal/negotiation) + terminal (won/lost)
    session.add_all(
        [
            Deal(tenant_id=tenant_id, title="d1", stage="lead", value_agorot=1000),
            Deal(tenant_id=tenant_id, title="d2", stage="qualified", value_agorot=2000),
            Deal(tenant_id=tenant_id, title="d3", stage="negotiation", value_agorot=3000),
            Deal(tenant_id=tenant_id, title="d4", stage="won", value_agorot=5000),
            Deal(tenant_id=tenant_id, title="d5", stage="lost", value_agorot=7000),
        ]
    )

    # Tasks: 2 not-done (open + in_progress) + 1 done
    session.add_all(
        [
            Task(tenant_id=tenant_id, title="t1", status="open"),
            Task(tenant_id=tenant_id, title="t2", status="in_progress"),
            Task(tenant_id=tenant_id, title="t3", status="done"),
        ]
    )

    # Tickets: open statuses new/open/pending count; resolved/closed do not
    session.add_all(
        [
            Ticket(tenant_id=tenant_id, subject="k1", status="new"),
            Ticket(tenant_id=tenant_id, subject="k2", status="pending"),
            Ticket(tenant_id=tenant_id, subject="k3", status="closed"),
        ]
    )
    await session.commit()


async def test_dashboard_summary_math(client, session, demo_tenant):
    await _seed_dashboard(session, demo_tenant.id)

    response = await client.get("/api/dashboard/summary")
    assert response.status_code == 200
    s = response.json()

    assert s["contacts_count"] == 4  # 3 + 1 lead-contact
    assert s["leads_count"] == 2  # only stage=new
    # open deals = lead + qualified + negotiation = 3
    assert s["open_deals_count"] == 3
    assert s["pipeline_value_agorot"] == 1000 + 2000 + 3000
    assert s["tasks_open_count"] == 2  # open + in_progress
    assert s["tickets_open_count"] == 2  # new + pending
    # won this month: the won deal was just created -> counted
    assert s["won_this_month_agorot"] == 5000

    # deals_by_stage covers all 6 stages, ordered
    stages = [b["stage"] for b in s["deals_by_stage"]]
    assert stages == ["lead", "qualified", "proposal", "negotiation", "won", "lost"]
    by_stage = {b["stage"]: b for b in s["deals_by_stage"]}
    assert by_stage["lead"]["count"] == 1
    assert by_stage["lead"]["value_agorot"] == 1000
    assert by_stage["proposal"]["count"] == 0
    assert by_stage["won"]["value_agorot"] == 5000


async def test_dashboard_summary_empty_tenant(client, demo_tenant):
    response = await client.get("/api/dashboard/summary")
    assert response.status_code == 200
    s = response.json()
    assert s["contacts_count"] == 0
    assert s["open_deals_count"] == 0
    assert s["pipeline_value_agorot"] == 0
    assert s["won_this_month_agorot"] == 0
    assert len(s["deals_by_stage"]) == 6
    assert all(b["count"] == 0 for b in s["deals_by_stage"])
