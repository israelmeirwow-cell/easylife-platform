"""fastapi-users v14 setup: cookie transport + JWT strategy.

Registration is tenant-bootstrapping: POST /api/auth/register with a
business_name creates the tenant and the owner user in one transaction
(+ tenant.created / user.registered events, same transaction).
"""

import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, exceptions, schemas
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.events import emit_event
from app.models import Tenant, User

logger = logging.getLogger("easylife.auth")


# --- Schemas ---------------------------------------------------------------


class UserRead(schemas.BaseUser[uuid.UUID]):
    tenant_id: uuid.UUID
    role: str
    wa_phone: str | None = None


class UserCreate(schemas.BaseUserCreate):
    business_name: str
    wa_phone: str | None = None


class UserUpdate(schemas.BaseUserUpdate):
    wa_phone: str | None = None


# --- User database / manager ----------------------------------------------


async def get_user_db(session: AsyncSession = Depends(get_session)) -> AsyncIterator[SQLAlchemyUserDatabase]:
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def create(
        self,
        user_create: schemas.UC,
        safe: bool = False,
        request: Request | None = None,
    ) -> User:
        """Register = create tenant + owner user + events in ONE transaction."""
        await self.validate_password(user_create.password, user_create)

        existing_user = await self.user_db.get_by_email(user_create.email)
        if existing_user is not None:
            raise exceptions.UserAlreadyExists()

        user_dict = (
            user_create.create_update_dict()
            if safe
            else user_create.create_update_dict_superuser()
        )
        password = user_dict.pop("password")
        business_name = user_dict.pop("business_name", None) or user_create.email
        user_dict["hashed_password"] = self.password_helper.hash(password)

        session: AsyncSession = self.user_db.session

        tenant = Tenant(name=business_name)
        session.add(tenant)
        await session.flush()

        user = User(**user_dict, tenant_id=tenant.id, role="owner")
        session.add(user)
        await session.flush()

        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=user.id,
            verb="tenant.created",
            entity_type="tenant",
            entity_id=tenant.id,
            payload={"name": tenant.name, "plan": tenant.plan},
        )
        await emit_event(
            session,
            tenant_id=tenant.id,
            actor_type="human",
            actor_id=user.id,
            verb="user.registered",
            entity_type="user",
            entity_id=user.id,
            payload={"email": user.email, "role": user.role},
        )
        await session.commit()

        await self.on_after_register(user, request)
        return user

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        logger.info("user registered: %s (tenant %s)", user.email, user.tenant_id)


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncIterator[UserManager]:
    yield UserManager(user_db)


# --- Auth backend: cookie transport + JWT strategy -------------------------

cookie_transport = CookieTransport(
    cookie_name="easylife_auth",
    cookie_max_age=60 * 60 * 24 * 7,
    cookie_secure=not settings.is_dev,
    cookie_samesite="lax",
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.SECRET_KEY, lifetime_seconds=60 * 60 * 24 * 7)


auth_backend = AuthenticationBackend(
    name="cookie-jwt",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
optional_current_user = fastapi_users.current_user(active=True, optional=True)


# --- Extra: /api/auth/me ---------------------------------------------------

me_router = APIRouter(prefix="/api/auth", tags=["auth"])


@me_router.get("/me", response_model=UserRead)
async def me(user: User = Depends(current_active_user)) -> User:
    return user
