"""Tickets: list (filter status) / create / patch.

Creation emits ticket.created. A status change emits ticket.status_changed;
any other field change emits ticket.updated. Writes share the row's transaction.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Ticket
from app.schemas import TicketCreate, TicketOut, TicketUpdate

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


async def _get_ticket_or_404(
    session: AsyncSession, tenant_id: uuid.UUID, ticket_id: uuid.UUID
) -> Ticket:
    result = await session.execute(
        select(Ticket).where(Ticket.tenant_id == tenant_id, Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.get("", response_model=list[TicketOut])
async def list_tickets(
    status: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Ticket]:
    query = select(Ticket).where(Ticket.tenant_id == tenant_id)
    if status is not None:
        query = query.where(Ticket.status == status)
    result = await session.execute(query.order_by(Ticket.created_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.post("", response_model=TicketOut, status_code=201)
async def create_ticket(
    body: TicketCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Ticket:
    ticket = Ticket(tenant_id=tenant_id, **body.model_dump())
    session.add(ticket)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
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
    await session.commit()
    return ticket


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: uuid.UUID,
    body: TicketUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Ticket:
    ticket = await _get_ticket_or_404(session, tenant_id, ticket_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return ticket

    old_status = ticket.status
    for field, value in changes.items():
        setattr(ticket, field, value)

    status_changed = ticket.status != old_status
    base_payload = {
        "subject": ticket.subject,
        "contact_id": str(ticket.contact_id) if ticket.contact_id else None,
    }
    if status_changed:
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="ticket.status_changed",
            entity_type="ticket",
            entity_id=ticket.id,
            payload={"from": old_status, "to": ticket.status, **base_payload},
        )
    else:
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="ticket.updated",
            entity_type="ticket",
            entity_id=ticket.id,
            payload={"fields": sorted(changes.keys()), **base_payload},
        )
    await session.commit()
    return ticket
