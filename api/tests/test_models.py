"""All 14 brain tables create and accept inserts on sqlite."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.db import Base
from app.models import (
    Account,
    Activity,
    AgentConfig,
    Approval,
    Channel,
    Contact,
    Conversation,
    Deal,
    Document,
    Event,
    Lead,
    Memory,
    Message,
    Task,
    Tenant,
    Ticket,
    UsageEvent,
    User,
)

# The 14 brain tables + the 4 CRM tables + the CEO findings table.
EXPECTED_TABLES = {
    "tenants",
    "users",
    "channels",
    "contacts",
    "conversations",
    "messages",
    "leads",
    "tasks",
    "approvals",
    "events",
    "memories",
    "agent_configs",
    "documents",
    "usage_events",
    "accounts",
    "deals",
    "tickets",
    "activities",
    "findings",
}


def test_all_tables_registered():
    assert set(Base.metadata.tables.keys()) == EXPECTED_TABLES


async def test_insert_every_table(session):
    tenant = Tenant(name="בדיקה בע\"מ")
    session.add(tenant)
    await session.flush()

    user = User(
        id=uuid.uuid4(),
        email="owner@test.co.il",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=False,
        tenant_id=tenant.id,
        role="owner",
        wa_phone="+972501234567",
    )
    channel = Channel(tenant_id=tenant.id, kind="whatsapp", status="connected")
    contact = Contact(
        tenant_id=tenant.id,
        name="ישראל ישראלי",
        phones=["+972501111111"],
        emails=["israel@example.com"],
        tags=["vip"],
    )
    session.add_all([user, channel, contact])
    await session.flush()

    account = Account(tenant_id=tenant.id, name="בוטיק לובלי", kind="business")
    conversation = Conversation(
        tenant_id=tenant.id, contact_id=contact.id, channel_id=channel.id
    )
    lead = Lead(tenant_id=tenant.id, contact_id=contact.id, value_agorot=19900)
    session.add_all([account, conversation, lead])
    await session.flush()

    deal = Deal(
        tenant_id=tenant.id,
        title="הזמנת קיץ",
        account_id=account.id,
        contact_id=contact.id,
        stage="proposal",
        value_agorot=3600000,
    )
    session.add(deal)
    await session.flush()

    task = Task(
        tenant_id=tenant.id,
        title="להתקשר ללקוח",
        contact_id=contact.id,
        account_id=account.id,
        deal_id=deal.id,
        priority="high",
    )
    ticket = Ticket(
        tenant_id=tenant.id,
        subject="משלוח התעכב",
        status="open",
        priority="urgent",
        contact_id=contact.id,
    )
    activity = Activity(
        tenant_id=tenant.id,
        kind="call",
        body="שיחת מכירה",
        contact_id=contact.id,
        account_id=account.id,
        deal_id=deal.id,
    )
    session.add_all([task, ticket, activity])
    await session.flush()

    message = Message(
        tenant_id=tenant.id,
        conversation_id=conversation.id,
        direction="in",
        sender_type="contact",
        body="שלום",
    )
    approval = Approval(
        tenant_id=tenant.id,
        requested_by_agent="whatsapp_support",
        action_type="refund",
        payload={"amount_agorot": 5000},
        preview_text="לאשר החזר?",
    )
    event = Event(
        tenant_id=tenant.id,
        actor_type="system",
        actor_id="test",
        verb="message.received",
        entity_type="message",
        payload={"k": "v"},
    )
    memory = Memory(
        tenant_id=tenant.id,
        scope="contact",
        entity_id=contact.id,
        text="מעדיף משלוח עד הבית",
        embedding=[0.1] * 8,  # JSON fallback on sqlite; Vector(1024) on postgres
        importance=0.8,
    )
    agent_config = AgentConfig(
        tenant_id=tenant.id, agent_kind="whatsapp_support", config={"tone": "friendly"}
    )
    document = Document(
        tenant_id=tenant.id,
        kind="invoice",
        amount_agorot=25900,
        direction="in",
        ts=datetime.now(timezone.utc),
    )
    usage = UsageEvent(
        tenant_id=tenant.id,
        kind="llm",
        model="claude-sonnet",
        tokens_in=100,
        tokens_out=50,
        cost_usd_micros=1234,
    )
    session.add_all([message, approval, event, memory, agent_config, document, usage])
    await session.commit()

    # Everything reads back
    assert (await session.execute(select(Tenant))).scalars().one().name == 'בדיקה בע"מ'
    assert (await session.execute(select(User))).scalars().one().role == "owner"
    assert (await session.execute(select(Contact))).scalars().one().phones == ["+972501111111"]
    assert (await session.execute(select(Lead))).scalars().one().value_agorot == 19900
    stored_event = (await session.execute(select(Event))).scalars().one()
    assert stored_event.id is not None  # autoincrement bigint pk
    assert stored_event.payload == {"k": "v"}
    stored_memory = (await session.execute(select(Memory))).scalars().one()
    assert stored_memory.embedding == [0.1] * 8
    assert (await session.execute(select(UsageEvent))).scalars().one().cost_usd_micros == 1234
    assert (await session.execute(select(Account))).scalars().one().name == "בוטיק לובלי"
    stored_deal = (await session.execute(select(Deal))).scalars().one()
    assert stored_deal.value_agorot == 3600000
    assert stored_deal.currency == "ILS"  # server/model default
    assert (await session.execute(select(Ticket))).scalars().one().priority == "urgent"
    assert (await session.execute(select(Activity))).scalars().one().kind == "call"


async def test_uuid_pks_and_tenant_scoping(session):
    tenant = Tenant(name="A")
    session.add(tenant)
    await session.flush()
    contact = Contact(tenant_id=tenant.id, name="X")
    session.add(contact)
    await session.commit()

    assert isinstance(tenant.id, uuid.UUID)
    assert isinstance(contact.id, uuid.UUID)
    assert contact.tenant_id == tenant.id
