"""Activities: list (filter by contact/account/deal) / create.

Logging an activity emits activity.logged in the same transaction as the row so
it shows up on the feed and on the account/contact/deal timelines.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import optional_current_user
from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Activity, User
from app.schemas import ActivityCreate, ActivityOut

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("", response_model=list[ActivityOut])
async def list_activities(
    contact_id: uuid.UUID | None = Query(None),
    account_id: uuid.UUID | None = Query(None),
    deal_id: uuid.UUID | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Activity]:
    query = select(Activity).where(Activity.tenant_id == tenant_id)
    if contact_id is not None:
        query = query.where(Activity.contact_id == contact_id)
    if account_id is not None:
        query = query.where(Activity.account_id == account_id)
    if deal_id is not None:
        query = query.where(Activity.deal_id == deal_id)
    result = await session.execute(query.order_by(Activity.occurred_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.post("", response_model=ActivityOut, status_code=201)
async def create_activity(
    body: ActivityCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    user: User | None = Depends(optional_current_user),
    session: AsyncSession = Depends(get_session),
) -> Activity:
    data = body.model_dump()
    occurred_at = data.pop("occurred_at", None) or datetime.now(timezone.utc)
    activity = Activity(
        tenant_id=tenant_id,
        occurred_at=occurred_at,
        actor_user_id=user.id if user is not None else None,
        **data,
    )
    session.add(activity)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
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
    return activity
