"""Contacts: list / get / timeline (events for the contact)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_tenant_id
from app.models import Contact, Event
from app.schemas import ContactOut, EventOut

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


async def _get_contact_or_404(
    session: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> Contact:
    result = await session.execute(
        select(Contact).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.get("", response_model=list[ContactOut])
async def list_contacts(
    limit: int = Query(100, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Contact]:
    result = await session.execute(
        select(Contact)
        .where(Contact.tenant_id == tenant_id)
        .order_by(Contact.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(
    contact_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> Contact:
    return await _get_contact_or_404(session, tenant_id, contact_id)


@router.get("/{contact_id}/timeline", response_model=list[EventOut])
async def contact_timeline(
    contact_id: uuid.UUID,
    limit: int = Query(100, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Event]:
    """The contact timeline is the events table read the contact way."""
    await _get_contact_or_404(session, tenant_id, contact_id)
    contact_ref = str(contact_id)
    result = await session.execute(
        select(Event)
        .where(
            Event.tenant_id == tenant_id,
            or_(
                and_(Event.entity_type == "contact", Event.entity_id == contact_ref),
                Event.payload["contact_id"].as_string() == contact_ref,
            ),
        )
        .order_by(Event.id.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
