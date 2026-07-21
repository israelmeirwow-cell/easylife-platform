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
from app.routers import approvals, contacts, conversations, feed, leads


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


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "env": settings.APP_ENV}
