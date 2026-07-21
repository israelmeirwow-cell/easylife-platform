"""Demo seed for the Easy Life brain.

    python -m app.seed          # create demo tenant + data (idempotent)
    python -m app.seed --live   # ...then emit a random Hebrew event every 3-6s

Demo tenant: "מאניה ג'ינס — דמו" — owner demo@easylife.co.il / demo1234.
"""

import argparse
import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi_users.password import PasswordHelper
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import Base, async_session_maker, engine
from app.deps import DEMO_TENANT_NAME
from app.events import emit_event
from app.models import (
    Approval,
    Channel,
    Contact,
    Conversation,
    Lead,
    Message,
    Tenant,
    User,
)

DEMO_EMAIL = "demo@easylife.co.il"
DEMO_PASSWORD = "demo1234"

CONTACTS = [
    {"name": "שרה כהן", "phone": "+972521111111", "tags": ["VIP", "לקוחה חוזרת"]},
    {"name": "דוד לוי", "phone": "+972522222222", "tags": ["ליד חדש"]},
    {"name": "מיכל אברמוב", "phone": "+972523333333", "tags": ["מידות מיוחדות"]},
    {"name": "יוסי מזרחי", "phone": "+972524444444", "tags": []},
    {"name": "רותם פרץ", "phone": "+972525555555", "tags": ["אינסטגרם"]},
    {"name": "אבי ביטון", "phone": "+972526666666", "tags": ["סיטונאי"]},
    {"name": "נועה שפירא", "phone": "+972527777777", "tags": ["VIP"]},
    {"name": "אלי גבאי", "phone": "+972528888888", "tags": ["החזרות"]},
]

# (contact index, stage, value_agorot, source)
LEADS = [
    (1, "new", 25900, "whatsapp"),
    (2, "contacted", 45800, "instagram"),
    (4, "qualified", 89900, "instagram"),
    (5, "won", 259000, "whatsapp"),
    (7, "lost", 19900, "facebook"),
]

# (contact index, [(direction, sender_type, body), ...])
CONVERSATIONS = [
    (
        0,
        [
            ("in", "contact", "היי, הזמנתי ג'ינס גזרה גבוהה במידה 38 ועדיין לא קיבלתי אישור משלוח"),
            ("out", "agent", "היי שרה! בדקתי — ההזמנה שלך (#1042) נארזה הבוקר ותצא היום עם שליח. מספר מעקב יישלח אלייך בהודעה נפרדת 📦"),
            ("in", "contact", "מעולה תודה! ואם המידה לא תתאים אפשר להחליף?"),
            ("out", "agent", "בטח — החלפה חינם תוך 14 יום. שומרים את החשבונית והתווית ואנחנו מסדרים הכל 😊"),
        ],
    ),
    (
        1,
        [
            ("in", "contact", "שלום, ראיתי אצלכם באינסטגרם ג'ינס בצבע בז'. יש במידה 42?"),
            ("out", "agent", "היי דוד! כן, נשארו אחרונים במידה 42. רוצה שאשריין לך זוג? אפשר לאסוף מהחנות או משלוח עד הבית"),
            ("in", "contact", "אשמח שתשריינו, אני מתלבט בין בז' לשחור"),
        ],
    ),
    (
        2,
        [
            ("in", "contact", "היי, קיבלתי את ההזמנה אבל הג'ינס קטן עליי. אפשר החזר כספי?"),
            ("out", "agent", "היי מיכל, מצטערים לשמוע! אפשר החלפה למידה גדולה יותר או החזר כספי. ההחזר דורש אישור מנהל — מעבירה את הבקשה עכשיו ונחזור אלייך היום"),
        ],
    ),
]

APPROVALS = [
    {
        "action_type": "refund",
        "payload": {"order_id": "1038", "amount_agorot": 18900, "contact_name": "מיכל אברמוב"},
        "preview_text": 'לאשר החזר כספי של ‏189 ₪ למיכל אברמוב על הזמנה #1038 (ג\'ינס סקיני שחור, מידה לא מתאימה)?',
    },
    {
        "action_type": "send_discount",
        "payload": {"discount_pct": 10, "contact_name": "דוד לוי"},
        "preview_text": "לשלוח לדוד לוי קוד הנחה של 10% כדי לסגור את הליד (מתלבט בין שני צבעים)?",
    },
]

LIVE_INBOUND = [
    "היי, יש את הג'ינס הרחב בצבע כחול בהיר במידה 40?",
    "מתי המשלוח שלי אמור להגיע?",
    "אפשר לשלם בביט?",
    "ראיתי בסטורי את הדגם החדש — אפשר פרטים?",
    "הגעתם? החנות פתוחה היום עד כמה?",
    "אפשר להחליף מידה בלי חשבונית?",
    "יש הנחה על זוג שני?",
    "הזמנה 1051 — אפשר לעדכן כתובת למשלוח?",
]

LIVE_APPROVALS = [
    {
        "action_type": "refund",
        "payload": {"amount_agorot": 15900},
        "preview_text": "לאשר החזר כספי של ‏159 ₪ ללקוח על פריט שהוחזר לחנות?",
    },
    {
        "action_type": "send_discount",
        "payload": {"discount_pct": 15},
        "preview_text": "לשלוח קוד הנחה 15% ללקוחה שנטשה עגלה עם 3 פריטים?",
    },
    {
        "action_type": "close_conversation",
        "payload": {},
        "preview_text": "לסגור שיחה פתוחה שלא נענתה כבר 48 שעות ולשלוח הודעת סיכום?",
    },
]

STAGE_FLOW = ["new", "contacted", "qualified", "won"]


async def _create_schema() -> None:
    """Convenience for local demos; production schema is managed by alembic."""
    async with engine.begin() as conn:
        if conn.dialect.name == "postgresql":
            await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def seed(session: AsyncSession) -> Tenant:
    existing = (
        await session.execute(select(Tenant).where(Tenant.name == DEMO_TENANT_NAME))
    ).scalar_one_or_none()
    if existing is not None:
        print(f"Demo tenant already exists ({existing.id}) — skipping seed")
        return existing

    now = datetime.now(timezone.utc)
    tenant = Tenant(name=DEMO_TENANT_NAME, plan="demo")
    session.add(tenant)
    await session.flush()

    owner = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        hashed_password=PasswordHelper().hash(DEMO_PASSWORD),
        is_active=True,
        is_superuser=False,
        is_verified=True,
        tenant_id=tenant.id,
        role="owner",
        wa_phone="+972520000000",
    )
    session.add(owner)

    channel = Channel(tenant_id=tenant.id, kind="whatsapp", status="connected", meta={"label": "מספר ראשי"})
    session.add(channel)
    await session.flush()

    await emit_event(
        session,
        tenant_id=tenant.id,
        actor_type="system",
        actor_id="seed",
        verb="tenant.created",
        entity_type="tenant",
        entity_id=tenant.id,
        payload={"name": tenant.name},
    )

    contacts: list[Contact] = []
    for spec in CONTACTS:
        contact = Contact(
            tenant_id=tenant.id,
            name=spec["name"],
            phones=[spec["phone"]],
            tags=spec["tags"],
        )
        session.add(contact)
        await session.flush()
        contacts.append(contact)
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="system",
            actor_id="whatsapp_connector",
            verb="contact.created",
            entity_type="contact",
            entity_id=contact.id,
            payload={"name": contact.name, "phone": spec["phone"]},
        )

    for contact_idx, stage, value_agorot, source in LEADS:
        lead = Lead(
            tenant_id=tenant.id,
            contact_id=contacts[contact_idx].id,
            stage=stage,
            value_agorot=value_agorot,
            source_channel=source,
        )
        session.add(lead)
        await session.flush()
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="agent",
            actor_id="lead_agent",
            verb="lead.seen",
            entity_type="lead",
            entity_id=lead.id,
            payload={
                "contact_id": str(lead.contact_id),
                "stage": stage,
                "value_agorot": value_agorot,
                "source_channel": source,
            },
        )
        if stage != "new":
            await emit_event(
                session,
                tenant_id=tenant.id,
                actor_type="agent",
                actor_id="lead_agent",
                verb="lead.stage_changed",
                entity_type="lead",
                entity_id=lead.id,
                payload={"from": "new", "to": stage, "contact_id": str(lead.contact_id)},
            )

    for offset, (contact_idx, messages) in enumerate(CONVERSATIONS):
        contact = contacts[contact_idx]
        conversation = Conversation(
            tenant_id=tenant.id,
            contact_id=contact.id,
            channel_id=channel.id,
            status="open",
            assignee="agent",
        )
        session.add(conversation)
        await session.flush()
        msg_ts = now - timedelta(hours=6 - offset * 2)
        for direction, sender_type, body in messages:
            message = Message(
                tenant_id=tenant.id,
                conversation_id=conversation.id,
                direction=direction,
                sender_type=sender_type,
                body=body,
                ts=msg_ts,
            )
            session.add(message)
            await session.flush()
            conversation.last_msg_at = msg_ts
            await emit_event(
                session,
                tenant_id=tenant.id,
                actor_type="contact" if direction == "in" else "agent",
                actor_id=str(contact.id) if direction == "in" else "whatsapp_support",
                verb="message.received" if direction == "in" else "message.sent",
                entity_type="message",
                entity_id=message.id,
                payload={
                    "contact_id": str(contact.id),
                    "contact_name": contact.name,
                    "conversation_id": str(conversation.id),
                    "body": body,
                },
            )
            msg_ts += timedelta(minutes=random.randint(2, 9))

    for spec in APPROVALS:
        approval = Approval(
            tenant_id=tenant.id,
            requested_by_agent="whatsapp_support",
            action_type=spec["action_type"],
            payload=spec["payload"],
            preview_text=spec["preview_text"],
            status="pending",
        )
        session.add(approval)
        await session.flush()
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="agent",
            actor_id="whatsapp_support",
            verb="approval.requested",
            entity_type="approval",
            entity_id=approval.id,
            payload={
                "action_type": approval.action_type,
                "preview_text": approval.preview_text,
            },
        )

    await session.commit()
    print(f"Seeded demo tenant {tenant.id}: 8 contacts, 5 leads, 3 conversations, 2 pending approvals")
    print(f"Owner login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    return tenant


async def _live_message(session: AsyncSession, tenant: Tenant) -> str:
    conversations = (
        (await session.execute(
            select(Conversation).where(Conversation.tenant_id == tenant.id)
        )).scalars().all()
    )
    if not conversations:
        return "no conversations to message"
    conversation = random.choice(conversations)
    contact = (
        await session.execute(select(Contact).where(Contact.id == conversation.contact_id))
    ).scalar_one()
    body = random.choice(LIVE_INBOUND)
    now = datetime.now(timezone.utc)
    message = Message(
        tenant_id=tenant.id,
        conversation_id=conversation.id,
        direction="in",
        sender_type="contact",
        body=body,
        ts=now,
    )
    session.add(message)
    conversation.last_msg_at = now
    conversation.status = "open"
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant.id,
        actor_type="contact",
        actor_id=str(contact.id),
        verb="message.received",
        entity_type="message",
        entity_id=message.id,
        payload={
            "contact_id": str(contact.id),
            "contact_name": contact.name,
            "conversation_id": str(conversation.id),
            "body": body,
        },
    )
    return f"message.received — {contact.name}: {body}"


async def _live_lead(session: AsyncSession, tenant: Tenant) -> str:
    leads = (
        (await session.execute(select(Lead).where(Lead.tenant_id == tenant.id))).scalars().all()
    )
    movable = [lead for lead in leads if lead.stage in STAGE_FLOW[:-1]]
    if not movable:
        return "no movable leads"
    lead = random.choice(movable)
    old_stage = lead.stage
    new_stage = STAGE_FLOW[STAGE_FLOW.index(old_stage) + 1]
    lead.stage = new_stage
    contact = (
        await session.execute(select(Contact).where(Contact.id == lead.contact_id))
    ).scalar_one()
    await emit_event(
        session,
        tenant_id=tenant.id,
        actor_type="agent",
        actor_id="lead_agent",
        verb="lead.stage_changed",
        entity_type="lead",
        entity_id=lead.id,
        payload={"from": old_stage, "to": new_stage, "contact_id": str(contact.id), "contact_name": contact.name},
    )
    return f"lead.stage_changed — {contact.name}: {old_stage} → {new_stage}"


async def _live_approval(session: AsyncSession, tenant: Tenant) -> str:
    spec = random.choice(LIVE_APPROVALS)
    approval = Approval(
        tenant_id=tenant.id,
        requested_by_agent="whatsapp_support",
        action_type=spec["action_type"],
        payload=spec["payload"],
        preview_text=spec["preview_text"],
        status="pending",
    )
    session.add(approval)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant.id,
        actor_type="agent",
        actor_id="whatsapp_support",
        verb="approval.requested",
        entity_type="approval",
        entity_id=approval.id,
        payload={"action_type": approval.action_type, "preview_text": approval.preview_text},
    )
    return f"approval.requested — {spec['preview_text']}"


async def live_loop(tenant_id) -> None:
    actions = [_live_message, _live_message, _live_lead, _live_approval]
    print("Live demo feed started — Ctrl+C to stop")
    while True:
        async with async_session_maker() as session:
            tenant = (
                await session.execute(select(Tenant).where(Tenant.id == tenant_id))
            ).scalar_one()
            action = random.choice(actions)
            description = await action(session, tenant)
            await session.commit()
        print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {description}")
        await asyncio.sleep(random.uniform(3.0, 6.0))


async def main(live: bool) -> None:
    await _create_schema()
    async with async_session_maker() as session:
        tenant = await seed(session)
        tenant_id = tenant.id
    if live:
        await live_loop(tenant_id)
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the Easy Life demo tenant")
    parser.add_argument("--live", action="store_true", help="emit a random Hebrew event every 3-6s forever")
    args = parser.parse_args()
    try:
        asyncio.run(main(live=args.live))
    except KeyboardInterrupt:
        print("\nStopped")
        sys.exit(0)
