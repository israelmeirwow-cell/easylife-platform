"""Dashboard feed: recent events + live SSE stream.

The feed, the contact timeline and agent context are the same events table
read three ways — this is the feed way.
"""

import json
import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.db import get_session
from app.deps import get_tenant_id
from app.events import event_bus
from app.models import Event
from app.schemas import EventOut

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("", response_model=list[EventOut])
async def list_feed(
    limit: int = Query(50, ge=1, le=200),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Event]:
    result = await session.execute(
        select(Event)
        .where(Event.tenant_id == tenant_id)
        .order_by(Event.id.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/stream")
async def stream_feed(
    request: Request,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> EventSourceResponse:
    """SSE stream of this tenant's events (verb as SSE event name, JSON data)."""

    async def event_generator():
        subscription = event_bus.subscribe(str(tenant_id))
        try:
            async for event in subscription:
                if await request.is_disconnected():
                    break
                yield {
                    "event": event.get("verb", "event"),
                    "id": str(event.get("id", "")),
                    "data": json.dumps(event, ensure_ascii=False, default=str),
                }
        finally:
            await subscription.aclose()

    return EventSourceResponse(event_generator(), ping=15)
