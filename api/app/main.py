"""Easy Life API entrypoint.

Run: uvicorn app.main:app --reload
"""

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import UserCreate, UserRead, auth_backend, fastapi_users, me_router
from app.config import settings
from app.events import pg_notify_listener
from app.routers import (
    accounts,
    activities,
    approvals,
    ceo,
    connections,
    contacts,
    conversations,
    dashboard,
    deals,
    feed,
    leads,
    tasks,
    tickets,
    webhooks,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    listener_task = asyncio.create_task(pg_notify_listener())
    yield
    listener_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await listener_task


app = FastAPI(title="Easy Life API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.WEB_BASE_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth (fastapi-users): /api/auth/login, /api/auth/logout, /api/auth/register, /api/auth/me
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/api/auth", tags=["auth"])
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate), prefix="/api/auth", tags=["auth"]
)
app.include_router(me_router)

# Brain routers (all tenant-scoped via app.deps.get_tenant_id)
app.include_router(feed.router)
app.include_router(contacts.router)
app.include_router(leads.router)
app.include_router(conversations.router)
app.include_router(approvals.router)

# CRM routers (Fireberry feature-parity — accounts / deals / tasks / tickets /
# activities / dashboard)
app.include_router(accounts.router)
app.include_router(deals.router)
app.include_router(tasks.router)
app.include_router(tickets.router)
app.include_router(activities.router)
app.include_router(dashboard.router)
app.include_router(ceo.router)
app.include_router(connections.router)

# Inbound channel webhooks (public — Meta/etc. deliver here; NOT tenant-scoped)
app.include_router(webhooks.router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "env": settings.APP_ENV}
