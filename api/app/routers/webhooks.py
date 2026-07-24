"""Inbound channel webhooks — WhatsApp Cloud API (stage A).

Meta delivers here. Two endpoints per Meta's contract:
- GET  /webhooks/whatsapp  — verification handshake (echo hub.challenge).
- POST /webhooks/whatsapp  — message notifications.

An inbound message is normalised into the ONE BRAIN in a single transaction:
contact (auto-created/merged by phone) -> conversation -> message(direction=in)
-> events row (message.received). The after_commit hook publishes that event to
the in-process EventBus, so any open /api/feed/stream sees it live.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.events import emit_event
from app.models import Channel, Contact, Conversation, Message, Tenant

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ---------------------------------------------------------------- verification
@router.get("/whatsapp")
async def verify_whatsapp(request: Request) -> PlainTextResponse:
    p = request.query_params
    if (
        p.get("hub.mode") == "subscribe"
        and p.get("hub.verify_token")
        and p.get("hub.verify_token") == settings.META_WEBHOOK_VERIFY_TOKEN
    ):
        return PlainTextResponse(p.get("hub.challenge", ""))
    return PlainTextResponse("verification failed", status_code=403)


# --------------------------------------------------------------------- receive
@router.post("/whatsapp")
async def receive_whatsapp(
    request: Request, session: AsyncSession = Depends(get_session)
) -> dict:
    body = await request.json()
    ingested = 0
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages")
            if not messages:
                continue  # delivery/read status callbacks — ignore for now
            phone_number_id = (value.get("metadata") or {}).get("phone_number_id")
            names = {
                c.get("wa_id"): (c.get("profile") or {}).get("name")
                for c in value.get("contacts", [])
            }
            tenant_id, channel_id = await _resolve_tenant_channel(session, phone_number_id)
            if tenant_id is None:
                continue
            for msg in messages:
                await _ingest_message(session, tenant_id, channel_id, msg, names)
                ingested += 1
    await session.commit()
    return {"received": ingested}


# ---------------------------------------------------------------------- helpers
async def _resolve_tenant_channel(
    session: AsyncSession, phone_number_id: str | None
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """Map a WhatsApp phone_number_id -> (tenant_id, channel_id).

    Prefers a whatsapp Channel whose meta.phone_number_id matches; otherwise
    falls back to the sole tenant (stage A single-tenant dev)."""
    channels = (
        await session.execute(select(Channel).where(Channel.kind == "whatsapp"))
    ).scalars().all()
    for ch in channels:
        if (ch.meta or {}).get("phone_number_id") == phone_number_id:
            return ch.tenant_id, ch.id
    tenant = (await session.execute(select(Tenant).limit(1))).scalars().first()
    return (tenant.id if tenant else None), None


async def _ingest_message(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID | None,
    msg: dict,
    names: dict[str, str | None],
) -> None:
    phone = msg.get("from")
    body, media = _extract_body(msg)

    contact = await _upsert_contact(session, tenant_id, phone, names.get(phone))
    conversation = await _get_or_open_conversation(session, tenant_id, contact.id, channel_id)

    ts = _parse_ts(msg.get("timestamp"))
    message = Message(
        tenant_id=tenant_id,
        conversation_id=conversation.id,
        direction="in",
        sender_type="contact",
        body=body,
        media=media,
        channel_msg_id=msg.get("id"),
        ts=ts,
    )
    session.add(message)
    conversation.status = "open"
    conversation.last_msg_at = ts
    await session.flush()

    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="contact",
        actor_id=contact.id,
        verb="message.received",
        entity_type="message",
        entity_id=message.id,
        payload={
            "channel": "whatsapp",
            "from": phone,
            "name": contact.name,
            "preview": (body or "")[:140],
            "conversation_id": str(conversation.id),
        },
    )


def _extract_body(msg: dict) -> tuple[str | None, dict]:
    t = msg.get("type")
    if t == "text":
        return (msg.get("text") or {}).get("body"), {}
    if t in ("image", "video", "audio", "document", "sticker"):
        obj = msg.get(t) or {}
        return obj.get("caption") or f"[{t}]", {"type": t, **obj}
    if t == "button":
        return (msg.get("button") or {}).get("text"), {}
    if t == "interactive":
        inter = msg.get("interactive") or {}
        reply = inter.get("button_reply") or inter.get("list_reply") or {}
        return reply.get("title"), {"interactive": inter}
    return f"[{t}]", {"raw": msg}


async def _upsert_contact(
    session: AsyncSession, tenant_id: uuid.UUID, phone: str | None, name: str | None
) -> Contact:
    contacts = (
        await session.execute(select(Contact).where(Contact.tenant_id == tenant_id))
    ).scalars().all()
    for c in contacts:
        if phone and phone in (c.phones or []):
            if name and not c.name:
                c.name = name
            return c
    contact = Contact(
        tenant_id=tenant_id,
        name=name,
        phones=[phone] if phone else [],
        handles={"whatsapp": phone} if phone else {},
    )
    session.add(contact)
    await session.flush()
    return contact


async def _get_or_open_conversation(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    channel_id: uuid.UUID | None,
) -> Conversation:
    existing = (
        await session.execute(
            select(Conversation)
            .where(Conversation.tenant_id == tenant_id, Conversation.contact_id == contact_id)
            .order_by(Conversation.created_at.desc())
        )
    ).scalars().first()
    if existing:
        return existing
    conversation = Conversation(
        tenant_id=tenant_id,
        contact_id=contact_id,
        channel_id=channel_id,
        status="open",
        assignee="agent",
    )
    session.add(conversation)
    await session.flush()
    return conversation


def _parse_ts(raw: str | None) -> datetime:
    try:
        return datetime.fromtimestamp(int(raw), tz=timezone.utc)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)
