"""Conversations: list + messages."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_tenant_id
from app.models import Channel, Contact, Conversation, Message
from app.schemas import ConversationOut, MessageOut

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[ConversationOut]:
    query = (
        select(Conversation, Contact.name)
        .join(Contact, Contact.id == Conversation.contact_id)
        .where(Conversation.tenant_id == tenant_id)
    )
    if status is not None:
        query = query.where(Conversation.status == status)
    result = await session.execute(
        query.order_by(Conversation.last_msg_at.desc().nullslast()).limit(limit)
    )
    rows = result.all()

    # channel_id -> kind (whatsapp/instagram/...) for the channel badge
    channels = (
        await session.execute(select(Channel.id, Channel.kind).where(Channel.tenant_id == tenant_id))
    ).all()
    kind_by_channel = {cid: kind for cid, kind in channels}

    out: list[ConversationOut] = []
    for conversation, contact_name in rows:
        item = ConversationOut.model_validate(conversation)
        item.contact_name = contact_name
        item.channel_kind = kind_by_channel.get(conversation.channel_id)
        last = (
            await session.execute(
                select(Message.body)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.ts.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        item.preview = last
        out.append(item)
    return out


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(200, ge=1, le=1000),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Message]:
    conversation = (
        await session.execute(
            select(Conversation).where(
                Conversation.tenant_id == tenant_id, Conversation.id == conversation_id
            )
        )
    ).scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await session.execute(
        select(Message)
        .where(Message.tenant_id == tenant_id, Message.conversation_id == conversation_id)
        .order_by(Message.ts.asc())
        .limit(limit)
    )
    return list(result.scalars().all())
