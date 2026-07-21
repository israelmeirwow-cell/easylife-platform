"""Connections — the Easy Life "חיבורים" screen.

Customer connects their own accounts (Instagram/Facebook/TikTok/Gmail/Google/…)
one-click. Composio powers the OAuth for `provider=composio` apps and is hidden
behind the Easy Life brand; `provider=native` apps are our own connectors
(WhatsApp flagship, store, invoicing). Every connection is a `channels` row and
emits a brain event so it shows in the feed.

Without a COMPOSIO_API_KEY the composio apps run in DEMO mode (a local connected
record) so the flow is demonstrable offline; add the key to go live.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.connections import composio_client
from app.connections.catalog import BY_SLUG, CATALOG, CATEGORIES_HE
from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Channel

router = APIRouter(prefix="/api/connections", tags=["connections"])

CONNECTED_STATUSES = ("connected", "demo_connected")


async def _tenant_channels(session: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Channel]:
    rows = (
        (await session.execute(select(Channel).where(Channel.tenant_id == tenant_id)))
        .scalars()
        .all()
    )
    # last one wins per kind (single connection per app in v1)
    return {c.kind: c for c in rows}


@router.get("/catalog")
async def catalog(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing = await _tenant_channels(session, tenant_id)
    apps = []
    for a in CATALOG:
        ch = existing.get(a.slug)
        apps.append(
            {
                "slug": a.slug,
                "name_he": a.name_he,
                "category": a.category,
                "category_he": CATEGORIES_HE.get(a.category, a.category),
                "provider": a.provider,
                "icon": a.icon,
                "note_he": a.note_he,
                "status": ch.status if ch else "disconnected",
                "connected": bool(ch and ch.status in CONNECTED_STATUSES),
                "channel_id": str(ch.id) if ch else None,
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
                    Channel.tenant_id == tenant_id,
                    Channel.status.in_(CONNECTED_STATUSES),
                )
            )
        )
        .scalars()
        .all()
    )
    return [
        {"id": str(c.id), "kind": c.kind, "status": c.status, "meta": c.meta}
        for c in rows
    ]


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

    existing = (await _tenant_channels(session, tenant_id)).get(slug)

    # --- native connectors: return their own onboarding path ---------------
    if app.provider == "native":
        return {
            "mode": "native",
            "slug": slug,
            "message_he": app.note_he or "חיבור ייעודי — נלווה אותך בהגדרה",
        }

    # --- composio-backed OAuth --------------------------------------------
    channel = existing or Channel(tenant_id=tenant_id, kind=slug, status="pending", meta={})
    if existing is None:
        session.add(channel)

    if composio_client.configured():
        callback = f"{settings.APP_BASE_URL}/api/connections/callback"
        try:
            result = await composio_client.initiate_connection(
                user_id=str(tenant_id), toolkit=app.toolkit or slug, callback_url=callback
            )
        except Exception as exc:  # network/api error — surface, don't fake success
            raise HTTPException(status_code=502, detail=f"composio_error: {exc}") from exc
        channel.status = "pending"
        channel.meta = {**channel.meta, "composio_connection_id": result.get("connection_id")}
        await session.commit()
        return {"mode": "oauth", "redirect_url": result.get("redirect_url"), "channel_id": str(channel.id)}

    # --- demo mode (no key): mark connected locally so the flow is visible --
    channel.status = "demo_connected"
    channel.meta = {**channel.meta, "demo": True}
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="connection.created",
        entity_type="channel",
        entity_id=channel.id,
        payload={"kind": slug, "name_he": app.name_he, "demo": True},
    )
    await session.commit()
    return {
        "mode": "demo",
        "channel_id": str(channel.id),
        "message_he": "חובר במצב דמו — הוסיפו מפתח Composio כדי לחבר חשבון אמיתי.",
    }


@router.get("/callback")
async def composio_callback(
    connectedAccountId: str | None = None,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Composio redirects here after the user finishes the OAuth consent."""
    if not connectedAccountId:
        return {"ok": False, "message_he": "לא התקבל מזהה חיבור"}
    row = (
        await session.execute(
            select(Channel).where(
                Channel.meta["composio_connection_id"].as_string() == connectedAccountId
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return {"ok": False, "message_he": "החיבור לא נמצא"}
    row.status = "connected" if (status or "").lower() in ("", "active", "success") else "error"
    if row.status == "connected":
        await emit_event(
            session,
            tenant_id=row.tenant_id,
            actor_type="human",
            actor_id="owner",
            verb="connection.created",
            entity_type="channel",
            entity_id=row.id,
            payload={"kind": row.kind},
        )
    await session.commit()
    return {"ok": row.status == "connected", "kind": row.kind}


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

    cid = (channel.meta or {}).get("composio_connection_id")
    if cid and composio_client.configured():
        await composio_client.disconnect(cid)

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
