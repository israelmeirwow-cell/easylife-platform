"""Composio adapter — the hidden breadth layer behind Easy Life "חיבורים".

Wraps Composio's v3 REST API for per-user (=per-tenant) OAuth connections.
Fully graceful without a key: `configured()` is False → the router runs in a
local DEMO mode so the UX and brain-event flow are demonstrable offline.

When COMPOSIO_API_KEY is set, live methods hit Composio. Each customer is a
Composio `user_id` = our tenant_id. White-labeling (consent screen shows
"Easy Life") requires our own OAuth apps registered as custom auth configs —
tracked separately; here we call whatever auth config is wired per toolkit.

NOTE: exact request/response shapes should be reconciled against live Composio
docs when the key lands; all HTTP lives here so that's a one-file change.
"""

from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger("easylife.connections.composio")

_TIMEOUT = httpx.Timeout(20.0)


def configured() -> bool:
    return bool(settings.COMPOSIO_API_KEY)


def _headers() -> dict:
    return {"x-api-key": settings.COMPOSIO_API_KEY, "Content-Type": "application/json"}


async def initiate_connection(user_id: str, toolkit: str, callback_url: str) -> dict:
    """Start an OAuth connection for a tenant. Returns {redirect_url, connection_id}."""
    if not configured():
        raise RuntimeError("composio_not_configured")
    async with httpx.AsyncClient(base_url=settings.COMPOSIO_BASE_URL, timeout=_TIMEOUT) as c:
        resp = await c.post(
            "/connected_accounts",
            headers=_headers(),
            json={
                "user_id": user_id,
                "toolkit": {"slug": toolkit},
                "callback_url": callback_url,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "redirect_url": data.get("redirect_url") or data.get("redirectUrl"),
            "connection_id": data.get("id") or data.get("connectionId"),
        }


async def list_connected(user_id: str) -> list[dict]:
    if not configured():
        return []
    async with httpx.AsyncClient(base_url=settings.COMPOSIO_BASE_URL, timeout=_TIMEOUT) as c:
        resp = await c.get(
            "/connected_accounts", headers=_headers(), params={"user_ids": user_id}
        )
        resp.raise_for_status()
        payload = resp.json()
        return payload.get("items", payload if isinstance(payload, list) else [])


async def disconnect(connection_id: str) -> bool:
    if not configured():
        return True
    async with httpx.AsyncClient(base_url=settings.COMPOSIO_BASE_URL, timeout=_TIMEOUT) as c:
        resp = await c.delete(f"/connected_accounts/{connection_id}", headers=_headers())
        return resp.status_code < 300
