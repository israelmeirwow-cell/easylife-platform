"""Async engine + session factory + declarative Base.

Works with both postgresql+asyncpg (dev/prod) and sqlite+aiosqlite (tests).
For in-memory sqlite a StaticPool is used so every session shares the single
in-memory database.
"""

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import settings


class Base(DeclarativeBase):
    pass


def _engine_kwargs(url: str) -> dict[str, Any]:
    if url.startswith("sqlite"):
        kwargs: dict[str, Any] = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in url or url.rstrip("/").endswith("sqlite+aiosqlite:"):
            kwargs["poolclass"] = StaticPool
        return kwargs
    return {"pool_pre_ping": True}


engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs(settings.DATABASE_URL))

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one AsyncSession per request."""
    async with async_session_maker() as session:
        yield session
