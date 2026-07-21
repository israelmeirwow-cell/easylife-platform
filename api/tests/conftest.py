"""Test setup: in-memory sqlite+aiosqlite, dev env (demo-tenant fallback).

Env vars are set BEFORE app imports so app.config.Settings picks them up.
"""

import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["APP_ENV"] = "dev"
os.environ["SECRET_KEY"] = "test-secret-key-0123456789-abcdefghijklmnop"
# Hermetic tests: no external API calls (override any key from a local .env).
os.environ["COMPOSIO_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.db import Base, async_session_maker, engine  # noqa: E402
from app.deps import DEMO_TENANT_NAME  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Tenant  # noqa: E402


@pytest.fixture(autouse=True)
async def db_schema():
    """Fresh schema per test (in-memory sqlite via StaticPool)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def session():
    async with async_session_maker() as s:
        yield s


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def demo_tenant(session):
    """The dev-fallback tenant that unauthenticated API requests are scoped to."""
    tenant = Tenant(name=DEMO_TENANT_NAME, plan="demo")
    session.add(tenant)
    await session.commit()
    result = await session.execute(select(Tenant).where(Tenant.name == DEMO_TENANT_NAME))
    return result.scalar_one()
