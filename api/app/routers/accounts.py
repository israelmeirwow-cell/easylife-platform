"""Accounts: list (search) / create / get / patch / timeline.

Tenant-scoped like every brain router. Each write emits an event in the same
transaction as the row (CLAUDE.md: if it's not in the feed, it didn't happen).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Account, Deal, Event
from app.schemas import AccountCreate, AccountOut, AccountUpdate, EventOut

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


async def _get_account_or_404(
    session: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID
) -> Account:
    result = await session.execute(
        select(Account).where(Account.tenant_id == tenant_id, Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    q: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Account]:
    query = select(Account).where(Account.tenant_id == tenant_id)
    if q:
        like = f"%{q}%"
        query = query.where(
            or_(
                Account.name.ilike(like),
                Account.email.ilike(like),
                Account.phone.ilike(like),
                Account.industry.ilike(like),
            )
        )
    result = await session.execute(query.order_by(Account.created_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.post("", response_model=AccountOut, status_code=201)
async def create_account(
    body: AccountCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Account:
    account = Account(tenant_id=tenant_id, **body.model_dump())
    session.add(account)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="account.created",
        entity_type="account",
        entity_id=account.id,
        payload={"name": account.name, "kind": account.kind},
    )
    await session.commit()
    return account


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> Account:
    return await _get_account_or_404(session, tenant_id, account_id)


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: uuid.UUID,
    body: AccountUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Account:
    account = await _get_account_or_404(session, tenant_id, account_id)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(account, field, value)
    if changes:
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="account.updated",
            entity_type="account",
            entity_id=account.id,
            payload={"fields": sorted(changes.keys())},
        )
        await session.commit()
    return account


@router.get("/{account_id}/timeline", response_model=list[EventOut])
async def account_timeline(
    account_id: uuid.UUID,
    limit: int = Query(100, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Event]:
    """Events for this account plus its linked contacts and deals.

    The timeline is the events table read the account way: any event whose
    entity is the account, or that carries this account_id / a contact_id or
    deal_id belonging to the account, in its payload.
    """
    await _get_account_or_404(session, tenant_id, account_id)
    account_ref = str(account_id)

    # Deals that belong to this account (their ids show up in deal events).
    deal_ids = (
        (
            await session.execute(
                select(Deal.id).where(
                    Deal.tenant_id == tenant_id, Deal.account_id == account_id
                )
            )
        )
        .scalars()
        .all()
    )
    deal_refs = {str(d) for d in deal_ids}

    # Contacts linked to this account through a deal — their contact events count too.
    contact_ids = (
        (
            await session.execute(
                select(Deal.contact_id).where(
                    Deal.tenant_id == tenant_id,
                    Deal.account_id == account_id,
                    Deal.contact_id.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    contact_refs = {str(c) for c in contact_ids if c is not None}

    conditions = [
        and_(Event.entity_type == "account", Event.entity_id == account_ref),
        Event.payload["account_id"].as_string() == account_ref,
    ]
    for deal_ref in deal_refs:
        conditions.append(and_(Event.entity_type == "deal", Event.entity_id == deal_ref))
        conditions.append(Event.payload["deal_id"].as_string() == deal_ref)
    for contact_ref in contact_refs:
        conditions.append(and_(Event.entity_type == "contact", Event.entity_id == contact_ref))
        conditions.append(Event.payload["contact_id"].as_string() == contact_ref)

    result = await session.execute(
        select(Event)
        .where(Event.tenant_id == tenant_id, or_(*conditions))
        .order_by(Event.id.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
