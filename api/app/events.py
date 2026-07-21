"""The heart of the brain: event emission + in-process EventBus.

Rules (CLAUDE.md):
- Every state change writes its domain row AND an events row in the SAME
  transaction (call emit_event with the caller's session before commit).
- events is APPEND-ONLY.
- After commit the event is published to the in-process EventBus so open SSE
  streams for that tenant receive it immediately.

Multi-process fan-out (future): postgres AFTER INSERT trigger on events calls
pg_notify('events', tenant_id::text); pg_notify_listener() bridges that into
the local bus. On sqlite (unit tests) the listener just logs and exits.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import event as sa_event
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Event

logger = logging.getLogger("easylife.events")

_PENDING_KEY = "easylife_pending_events"


class EventBus:
    """Per-tenant asyncio pub/sub. In-process; pg_notify bridges other processes.

    publish() dedupes on event id (per tenant, small LRU) so an event that
    arrives both via the local after_commit hook AND via the pg_notify bridge
    is delivered to subscribers exactly once.
    """

    _DEDUPE_SIZE = 1024

    def __init__(self) -> None:
        self._queues: dict[str, set[asyncio.Queue]] = {}
        self._seen: dict[str, dict[Any, None]] = {}

    def _is_duplicate(self, tenant_id: str, event: dict[str, Any]) -> bool:
        event_id = event.get("id")
        if event_id is None:
            return False
        seen = self._seen.setdefault(tenant_id, {})
        if event_id in seen:
            return True
        seen[event_id] = None
        while len(seen) > self._DEDUPE_SIZE:
            seen.pop(next(iter(seen)))
        return False

    def publish(self, tenant_id: str, event: dict[str, Any]) -> None:
        tenant_id = str(tenant_id)
        if self._is_duplicate(tenant_id, event):
            return
        for queue in tuple(self._queues.get(tenant_id, ())):
            queue.put_nowait(event)

    def subscribe(self, tenant_id: str) -> AsyncIterator[dict[str, Any]]:
        """Register a subscriber queue NOW; returns an async iterator of events.

        Close the iterator (aclose / GC) to unsubscribe.
        """
        key = str(tenant_id)
        queue: asyncio.Queue = asyncio.Queue()
        self._queues.setdefault(key, set()).add(queue)

        async def _iterator() -> AsyncIterator[dict[str, Any]]:
            try:
                while True:
                    yield await queue.get()
            finally:
                subscribers = self._queues.get(key)
                if subscribers is not None:
                    subscribers.discard(queue)
                    if not subscribers:
                        self._queues.pop(key, None)

        return _iterator()

    def subscriber_count(self, tenant_id: str) -> int:
        return len(self._queues.get(str(tenant_id), ()))


event_bus = EventBus()


def event_to_dict(event: Event) -> dict[str, Any]:
    return {
        "id": event.id,
        "tenant_id": str(event.tenant_id),
        "actor_type": event.actor_type,
        "actor_id": event.actor_id,
        "verb": event.verb,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "payload": event.payload,
        "ts": event.ts.isoformat() if event.ts else None,
    }


@sa_event.listens_for(Session, "after_commit")
def _publish_pending(session: Session) -> None:
    for event_dict in session.info.pop(_PENDING_KEY, []):
        event_bus.publish(event_dict["tenant_id"], event_dict)


@sa_event.listens_for(Session, "after_rollback")
def _drop_pending(session: Session) -> None:
    session.info.pop(_PENDING_KEY, None)


async def emit_event(
    session: AsyncSession,
    *,
    tenant_id,
    actor_type: str,
    actor_id,
    verb: str,
    entity_type: str | None,
    entity_id,
    payload: dict | None = None,
) -> Event:
    """Insert an events row in the CALLER's transaction.

    The caller owns the commit; publication to the EventBus happens only after
    that commit succeeds (after_commit hook), never on rollback.
    """
    if "." not in verb:
        logger.warning("event verb %r does not follow entity.verb form", verb)
    event = Event(
        tenant_id=tenant_id,
        actor_type=actor_type,
        actor_id=str(actor_id) if actor_id is not None else None,
        verb=verb,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        payload=payload or {},
    )
    session.add(event)
    await session.flush()  # assign id inside the caller's transaction

    sync_session = session.sync_session
    sync_session.info.setdefault(_PENDING_KEY, []).append(event_to_dict(event))
    return event


async def pg_notify_listener() -> None:
    """LISTEN on the 'events' channel — multi-process fan-out bridge.

    Starts only on postgres; on sqlite it logs and returns (unit tests run
    single-process where the in-process bus is sufficient). On each NOTIFY it
    fetches events newer than the last id seen and publishes them to the local
    bus (EventBus dedupes same-process events already published after commit).
    This is what makes `python -m app.seed --live` reach open dashboards.
    """
    from app.db import engine

    if engine.dialect.name != "postgresql":
        logger.info(
            "pg_notify listener disabled: dialect %r is not postgresql "
            "(in-process EventBus only)",
            engine.dialect.name,
        )
        return

    import json

    import asyncpg

    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
    while True:
        try:
            conn = await asyncpg.connect(dsn)
            try:
                notifications: asyncio.Queue[str] = asyncio.Queue()

                def _on_notify(_conn, _pid, channel, tenant_id) -> None:
                    logger.debug("pg_notify %r: tenant=%s", channel, tenant_id)
                    notifications.put_nowait(tenant_id)

                last_id: int = await conn.fetchval("SELECT COALESCE(MAX(id), 0) FROM events")
                await conn.add_listener("events", _on_notify)
                logger.info("pg_notify listener attached on channel 'events' (last_id=%s)", last_id)

                while True:
                    await notifications.get()
                    # Drain coalesced notifications, then fetch everything new.
                    while not notifications.empty():
                        notifications.get_nowait()
                    rows = await conn.fetch(
                        "SELECT id, tenant_id, actor_type, actor_id, verb, entity_type,"
                        " entity_id, payload, ts FROM events WHERE id > $1 ORDER BY id",
                        last_id,
                    )
                    for row in rows:
                        last_id = row["id"]
                        payload = row["payload"]
                        if isinstance(payload, str):
                            payload = json.loads(payload)
                        event_bus.publish(
                            str(row["tenant_id"]),
                            {
                                "id": row["id"],
                                "tenant_id": str(row["tenant_id"]),
                                "actor_type": row["actor_type"],
                                "actor_id": row["actor_id"],
                                "verb": row["verb"],
                                "entity_type": row["entity_type"],
                                "entity_id": row["entity_id"],
                                "payload": payload,
                                "ts": row["ts"].isoformat() if row["ts"] else None,
                            },
                        )
            finally:
                await conn.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("pg_notify listener error; retrying in 5s")
            await asyncio.sleep(5)
