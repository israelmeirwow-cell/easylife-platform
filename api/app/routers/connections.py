"""Connections — the Easy Life "חיבורים" screen.

Composio (via MCP — see app/connections/composio_mcp.py) powers OAuth for the
`provider=composio` apps and is hidden behind the Easy Life brand; `native`
apps are our own connectors. Every connection is a `channels` row and emits a
brain event so it shows in the feed.

With a Composio key set, the catalog reflects LIVE connection status and the
connect button returns a real OAuth link. Without a key, composio apps run in
DEMO mode so the flow is demonstrable offline.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connections import composio_client
from app.connections.catalog import BY_SLUG, CATALOG, CATEGORIES_HE
from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Channel

router = APIRouter(prefix="/api/connections", tags=["connections"])

CONNECTED_STATUSES = ("connected", "demo_connected")
# our catalog slug -> composio toolkit, and reverse
SLUG_BY_TOOLKIT = {a.toolkit: a.slug for a in CATALOG if a.provider == "composio" and a.toolkit}


async def _tenant_channels(session: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Channel]:
    rows = (
        (await session.execute(select(Channel).where(Channel.tenant_id == tenant_id)))
        .scalars()
        .all()
    )
    return {c.kind: c for c in rows}


@router.get("/catalog")
async def catalog(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing = await _tenant_channels(session, tenant_id)
    live = await composio_client.live_statuses(str(tenant_id))  # {} if not configured / on error

    apps = []
    for a in CATALOG:
        ch = existing.get(a.slug)
        live_info = live.get(a.toolkit) if a.toolkit else None
        connected = bool(ch and ch.status in CONNECTED_STATUSES)
        status = ch.status if ch else "disconnected"
        account_id = (ch.meta or {}).get("account_id") if ch else None
        if live_info is not None:  # Composio is the source of truth for its apps
            connected = live_info["connected"]
            status = "connected" if connected else "disconnected"
            account_id = live_info.get("account_id") or account_id
        apps.append(
            {
                "slug": a.slug,
                "name_he": a.name_he,
                "category": a.category,
                "category_he": CATEGORIES_HE.get(a.category, a.category),
                "provider": a.provider,
                "icon": a.icon,
                "note_he": a.note_he,
                "status": status,
                "connected": connected,
                "channel_id": str(ch.id) if ch else None,
                "account_id": account_id,
            }
        )
    return {
        "apps": apps,
        "categories": CATEGORIES_HE,
        "composio_configured": composio_client.configured(),
    }


@router.get("")
async def list_connections(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    rows = (
        (
            await session.execute(
                select(Channel).where(
                    Channel.tenant_id == tenant_id, Channel.status.in_(CONNECTED_STATUSES)
                )
            )
        )
        .scalars()
        .all()
    )
    return [{"id": str(c.id), "kind": c.kind, "status": c.status, "meta": c.meta} for c in rows]


async def _upsert_channel(
    session: AsyncSession, tenant_id: uuid.UUID, slug: str, status: str, meta_updates: dict
) -> Channel:
    ch = (await _tenant_channels(session, tenant_id)).get(slug)
    if ch is None:
        ch = Channel(tenant_id=tenant_id, kind=slug, status=status, meta={})
        session.add(ch)
    ch.status = status
    ch.meta = {**(ch.meta or {}), **meta_updates}
    await session.flush()
    return ch


@router.post("/{slug}/connect")
async def connect(
    slug: str,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    app = BY_SLUG.get(slug)
    if app is None:
        raise HTTPException(status_code=404, detail="Unknown app")

    if app.provider == "native":
        return {"mode": "native", "slug": slug, "message_he": app.note_he or "חיבור ייעודי — נלווה אותך בהגדרה"}

    # composio-backed via REST (per-tenant OAuth)
    if composio_client.configured():
        try:
            result = await composio_client.initiate_connection(str(tenant_id), app.toolkit or slug)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"composio_error: {exc}") from exc
        await _upsert_channel(
            session,
            tenant_id,
            slug,
            "pending",
            {"toolkit": app.toolkit, "account_id": result.get("connected_account_id")},
        )
        await session.commit()
        return {"mode": "oauth", "redirect_url": result.get("redirect_url"), "slug": slug}

    # demo mode (no key)
    ch = await _upsert_channel(session, tenant_id, slug, "demo_connected", {"demo": True})
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="connection.created",
        entity_type="channel",
        entity_id=ch.id,
        payload={"kind": slug, "name_he": app.name_he, "demo": True},
    )
    await session.commit()
    return {
        "mode": "demo",
        "channel_id": str(ch.id),
        "message_he": "חובר במצב דמו — הוסיפו מפתח Composio כדי לחבר חשבון אמיתי.",
    }


@router.post("/sync")
async def sync(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Pull live Composio statuses and persist newly-connected apps as channels
    (+ a connection.created event) so the brain/feed reflect real connections."""
    live = await composio_client.live_statuses(str(tenant_id))
    existing = await _tenant_channels(session, tenant_id)
    created = 0
    for toolkit, info in live.items():
        if not info.get("connected"):
            continue
        slug = SLUG_BY_TOOLKIT.get(toolkit)
        if not slug:
            continue
        ch = existing.get(slug)
        if ch and ch.status == "connected":
            continue
        ch = await _upsert_channel(
            session, tenant_id, slug, "connected", {"toolkit": toolkit, "account_id": info.get("account_id")}
        )
        await emit_event(
            session,
            tenant_id=tenant_id,
            actor_type="human",
            actor_id=actor_id,
            verb="connection.created",
            entity_type="channel",
            entity_id=ch.id,
            payload={"kind": slug, "toolkit": toolkit},
        )
        created += 1
    await session.commit()
    return {"synced": len(live), "newly_connected": created}


@router.post("/{channel_id}/disconnect")
async def disconnect(
    channel_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    channel = (
        await session.execute(
            select(Channel).where(Channel.tenant_id == tenant_id, Channel.id == channel_id)
        )
    ).scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    meta = channel.meta or {}
    account_id = meta.get("account_id")
    if account_id and composio_client.configured():
        await composio_client.disconnect(account_id)

    kind = channel.kind
    channel.status = "disconnected"
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="connection.removed",
        entity_type="channel",
        entity_id=channel.id,
        payload={"kind": kind},
    )
    await session.commit()
    return {"ok": True, "kind": kind}
