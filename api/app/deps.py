"""Shared dependencies — most importantly tenant scoping.

Every router resolves tenant_id through get_tenant_id:
- authenticated user -> user.tenant_id (cross-tenant isolation is sacred);
- APP_ENV=dev and no auth -> demo tenant fallback (auto-created) so the
  dashboard and SSE feed can be demoed without logging in.
"""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import optional_current_user
from app.config import settings
from app.db import get_session
from app.models import Tenant, User

DEMO_TENANT_NAME = "מאניה ג'ינס — דמו"


async def get_demo_tenant(session: AsyncSession) -> Tenant:
    result = await session.execute(select(Tenant).where(Tenant.name == DEMO_TENANT_NAME))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(name=DEMO_TENANT_NAME, plan="demo")
        session.add(tenant)
        await session.commit()
    return tenant


async def get_tenant_id(
    user: User | None = Depends(optional_current_user),
    session: AsyncSession = Depends(get_session),
) -> uuid.UUID:
    if user is not None:
        return user.tenant_id
    if settings.is_dev:
        tenant = await get_demo_tenant(session)
        return tenant.id
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


async def get_actor_id(user: User | None = Depends(optional_current_user)) -> str:
    """Actor id for events emitted from API handlers ('demo' in dev fallback)."""
    return str(user.id) if user is not None else "demo"
