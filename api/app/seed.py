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
    Account,
    Activity,
    Approval,
    Channel,
    Contact,
    Conversation,
    Deal,
    Lead,
    Message,
    Task,
    Tenant,
    Ticket,
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

# --- CRM demo data (fashion wholesale/retail) -----------------------------

# name, kind, phone, email, website, industry, tags
ACCOUNTS = [
    {
        "name": "בוטיק לובלי אשדוד",
        "kind": "business",
        "phone": "+97286221100",
        "email": "orders@lovely-ashdod.co.il",
        "website": "lovely-ashdod.co.il",
        "industry": "קמעונאות אופנה",
        "tags": ["לקוח סיטונאי", "דרום"],
    },
    {
        "name": "רשת סטייל בע\"מ",
        "kind": "business",
        "phone": "+97239500200",
        "email": "purchasing@style-chain.co.il",
        "website": "style-chain.co.il",
        "industry": "רשת חנויות",
        "tags": ["רשת", "VIP"],
    },
    {
        "name": "דניז קולקשן",
        "kind": "business",
        "phone": "+97248880055",
        "email": "deniz@deniz-collection.co.il",
        "website": "deniz-collection.co.il",
        "industry": "יבוא אופנה",
        "tags": ["צפון"],
    },
    {
        "name": "אאוטלט פאשן חיפה",
        "kind": "business",
        "phone": "+97248123123",
        "email": "info@outlet-haifa.co.il",
        "website": "outlet-haifa.co.il",
        "industry": "אאוטלט",
        "tags": ["מחיר", "צפון"],
    },
    {
        "name": "חנות הג'ינס של רוני",
        "kind": "business",
        "phone": "+97297771234",
        "email": "roni@roni-jeans.co.il",
        "website": "roni-jeans.co.il",
        "industry": "קמעונאות אופנה",
        "tags": ["מרכז"],
    },
    {
        "name": "מיכל אברמוב (פרטי)",
        "kind": "person",
        "phone": "+972523333333",
        "email": "michal.abramov@gmail.com",
        "website": None,
        "industry": None,
        "tags": ["מידות מיוחדות"],
    },
]

# title, account_idx, contact_idx (or None), stage, value_agorot, source
DEALS = [
    ("הזמנת קיץ — 120 ג'ינסים גזרה גבוהה", 0, 0, "lead", 3600000, "whatsapp"),
    ("קולקציית סתיו לרשת — 8 חנויות", 1, None, "qualified", 12800000, "email"),
    ("מארז ג'ינס בויפרנד סיטונאי", 2, None, "proposal", 5400000, "instagram"),
    ("ריאורדר דגם סקיני שחור x200", 1, None, "negotiation", 4200000, "whatsapp"),
    ("עסקת אאוטלט — עודפי מלאי חורף", 3, None, "negotiation", 2900000, "email"),
    ("הזמנה ראשונה חנות רוני", 4, None, "won", 1850000, "whatsapp"),
    ("מכירת סטוק ג'ינס בהיר", 0, 0, "won", 990000, "instagram"),
    ("הצעת מחיר קולקציית גברים", 2, None, "lost", 3100000, "email"),
    ("חבילת מידות פלוס לבוטיק", 0, 5, "proposal", 2450000, "whatsapp"),
    ("דגם חדש — פיילוט 30 יחידות", 4, None, "qualified", 720000, "instagram"),
]

# title, status, priority, contact_idx (or None), account_idx (or None), deal_idx (or None), description
TASKS = [
    ("להתקשר לבוטיק לובלי לגבי הזמנת הקיץ", "open", "high", 0, 0, 0, "לסגור כמויות וצבעים"),
    ("לשלוח קטלוג סתיו לרשת סטייל", "in_progress", "high", None, 1, 1, "כולל מחירון סיטונאי מעודכן"),
    ("להכין הצעת מחיר למארז בויפרנד", "open", "normal", None, 2, 2, None),
    ("מעקב אחרי משא ומתן ריאורדר סקיני", "in_progress", "normal", None, 1, 3, "ממתין לאישור כמות"),
    ("לתאם משלוח עסקת אאוטלט", "open", "normal", None, 3, 4, None),
    ("לשלוח חשבונית לחנות רוני", "done", "normal", None, 4, 5, "עסקה נסגרה"),
    ("לעדכן מלאי אחרי מכירת הסטוק", "done", "low", 0, 0, 6, None),
    ("לחזור למיכל לגבי מידות פלוס", "open", "high", 5, 0, 8, "מתלבטת בין שני דגמים"),
]

# subject, body, status, priority, contact_idx, channel_kind
TICKETS = [
    ("משלוח התעכב — הזמנה #1042", "הלקוחה מדווחת שהחבילה לא הגיעה תוך 3 ימים", "open", "high", 0, "whatsapp"),
    ("בקשה להחזר כספי — מידה לא מתאימה", "הג'ינס קטן, מבקשת החזר במקום החלפה", "pending", "normal", 2, "whatsapp"),
    ("שאלה על זמינות מלאי בז' מידה 42", "מתעניין אם נשאר במלאי", "resolved", "low", 1, "instagram"),
    ("תלונה על תפר פגום", "התקבל פריט עם תפר פתוח, מבקשת החלפה דחופה", "new", "urgent", 6, "email"),
    ("עדכון כתובת למשלוח הזמנה 1051", "לקוח ביקש לשנות כתובת אחרי ההזמנה", "closed", "normal", 3, "whatsapp"),
]

# kind, body, contact_idx (or None), account_idx (or None), deal_idx (or None), hours_ago
ACTIVITIES = [
    ("call", "שיחת טלפון עם הבוטיק — סוכם על 120 יח' בגזרה גבוהה, ממתין להזמנה רשמית", 0, 0, 0, 30),
    ("meeting", "פגישת זום עם רשת סטייל להצגת קולקציית הסתיו", None, 1, 1, 48),
    ("email", "נשלחה הצעת מחיר למארז הבויפרנד הסיטונאי", None, 2, 2, 26),
    ("whatsapp", "התכתבות עם דניז לגבי מארז — ביקשו הנחת כמות", None, 2, 2, 20),
    ("note", "רשת סטייל מעדיפה אספקה בפעימות — לפצל משלוח ל-2", None, 1, 1, 18),
    ("call", "שיחה עם חנות רוני — סגרנו את ההזמנה הראשונה!", None, 4, 5, 72),
    ("note", "אאוטלט חיפה לחוץ על מחיר, לבדוק גמישות על עודפי חורף", None, 3, 4, 12),
    ("email", "נשלחה חשבונית לחנות רוני על הזמנה שנסגרה", None, 4, 5, 70),
    ("whatsapp", "מיכל שאלה על מידות פלוס — שלחתי תמונות של שני דגמים", 5, 0, 8, 8),
    ("meeting", "פגישת היכרות עם חנות רוני בעפולה", None, 4, None, 96),
    ("note", "ליד חדש מאינסטגרם — פיילוט 30 יח' לדגם החדש", None, 4, 9, 6),
    ("call", "שיחת מעקב עם בוטיק לובלי על עסקת הסטוק שנסגרה", 0, 0, 6, 68),
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

    # --- CRM: accounts / deals / tasks / tickets / activities --------------
    accounts: list[Account] = []
    for spec in ACCOUNTS:
        account = Account(
            tenant_id=tenant.id,
            name=spec["name"],
            kind=spec["kind"],
            phone=spec["phone"],
            email=spec["email"],
            website=spec["website"],
            industry=spec["industry"],
            owner_user_id=owner.id,
            tags=spec["tags"],
        )
        session.add(account)
        await session.flush()
        accounts.append(account)
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=owner.id,
            verb="account.created",
            entity_type="account",
            entity_id=account.id,
            payload={"name": account.name, "kind": account.kind},
        )

    deals: list[Deal] = []
    for title, account_idx, contact_idx, stage, value_agorot, source in DEALS:
        deal = Deal(
            tenant_id=tenant.id,
            title=title,
            account_id=accounts[account_idx].id,
            contact_id=contacts[contact_idx].id if contact_idx is not None else None,
            pipeline="sales",
            stage=stage,
            value_agorot=value_agorot,
            source_channel=source,
            owner_user_id=owner.id,
        )
        session.add(deal)
        await session.flush()
        deals.append(deal)
        deal_payload = {
            "title": deal.title,
            "stage": deal.stage,
            "pipeline": deal.pipeline,
            "value_agorot": deal.value_agorot,
            "account_id": str(deal.account_id) if deal.account_id else None,
            "contact_id": str(deal.contact_id) if deal.contact_id else None,
        }
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=owner.id,
            verb="deal.created",
            entity_type="deal",
            entity_id=deal.id,
            payload=deal_payload,
        )
        if stage in ("won", "lost"):
            await emit_event(
                session,
                tenant_id=tenant.id,
                actor_type="human",
                actor_id=owner.id,
                verb=f"deal.{stage}",
                entity_type="deal",
                entity_id=deal.id,
                payload=deal_payload,
            )

    for title, status, priority, contact_idx, account_idx, deal_idx, description in TASKS:
        task = Task(
            tenant_id=tenant.id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            contact_id=contacts[contact_idx].id if contact_idx is not None else None,
            account_id=accounts[account_idx].id if account_idx is not None else None,
            deal_id=deals[deal_idx].id if deal_idx is not None else None,
            assignee_user_id=owner.id,
            created_by=owner.id,
        )
        session.add(task)
        await session.flush()
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=owner.id,
            verb="task.created",
            entity_type="task",
            entity_id=task.id,
            payload={"title": task.title, "status": task.status, "priority": task.priority},
        )
        if status == "done":
            await emit_event(
                session,
                tenant_id=tenant.id,
                actor_type="human",
                actor_id=owner.id,
                verb="task.completed",
                entity_type="task",
                entity_id=task.id,
                payload={"title": task.title, "status": task.status},
            )

    for subject, body, status, priority, contact_idx, channel_kind in TICKETS:
        ticket = Ticket(
            tenant_id=tenant.id,
            subject=subject,
            body=body,
            status=status,
            priority=priority,
            contact_id=contacts[contact_idx].id if contact_idx is not None else None,
            channel_kind=channel_kind,
            assignee_user_id=owner.id,
        )
        session.add(ticket)
        await session.flush()
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=owner.id,
            verb="ticket.created",
            entity_type="ticket",
            entity_id=ticket.id,
            payload={
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority,
                "contact_id": str(ticket.contact_id) if ticket.contact_id else None,
            },
        )

    for kind, body, contact_idx, account_idx, deal_idx, hours_ago in ACTIVITIES:
        activity = Activity(
            tenant_id=tenant.id,
            kind=kind,
            body=body,
            contact_id=contacts[contact_idx].id if contact_idx is not None else None,
            account_id=accounts[account_idx].id if account_idx is not None else None,
            deal_id=deals[deal_idx].id if deal_idx is not None else None,
            actor_user_id=owner.id,
            occurred_at=now - timedelta(hours=hours_ago),
        )
        session.add(activity)
        await session.flush()
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=owner.id,
            verb="activity.logged",
            entity_type="activity",
            entity_id=activity.id,
            payload={
                "kind": activity.kind,
                "body": activity.body,
                "contact_id": str(activity.contact_id) if activity.contact_id else None,
                "account_id": str(activity.account_id) if activity.account_id else None,
                "deal_id": str(activity.deal_id) if activity.deal_id else None,
            },
        )

    await session.commit()
    print(f"Seeded demo tenant {tenant.id}: 8 contacts, 5 leads, 3 conversations, 2 pending approvals")
    print(
        f"  CRM: {len(ACCOUNTS)} accounts, {len(DEALS)} deals, {len(TASKS)} tasks, "
        f"{len(TICKETS)} tickets, {len(ACTIVITIES)} activities"
    )
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
