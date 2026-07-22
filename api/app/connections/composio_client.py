"""Composio adapter — REST v3, MULTI-TENANT (hidden breadth layer behind "חיבורים").

Uses a Composio REST *project* key (x-api-key). Each Easy Life tenant maps to a
Composio `user_id` (= tenant_id), so every customer connects THEIR OWN accounts:

  1. ensure_auth_config(toolkit) — one Composio-managed OAuth config per toolkit,
     created once at the project level and reused for all tenants (cached).
  2. initiate_connection(tenant_id, toolkit) — POST /connected_accounts/link with
     {auth_config_id, user_id} → returns a real redirect_url + connected_account_id.
  3. live_statuses(tenant_id) — GET /connected_accounts?user_ids=tenant_id.
  4. disconnect(connected_account_id) — DELETE /connected_accounts/{id}.

All endpoints verified live against backend.composio.dev/api/v3.
Graceful without a key: configured() is False → the router runs demo mode.
"""

from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.connections.catalog import CATALOG

logger = logging.getLogger("easylife.connections.composio")

_TIMEOUT = httpx.Timeout(30.0)
# toolkit slug -> auth_config id (ac_...), resolved lazily and cached per process
_AUTH_CONFIG_CACHE: dict[str, str] = {}

TOOLKIT_BY_SLUG = {a.slug: a.toolkit for a in CATALOG if a.provider == "composio" and a.toolkit}
SLUG_BY_TOOLKIT = {v: k for k, v in TOOLKIT_BY_SLUG.items()}


def configured() -> bool:
    return bool(settings.COMPOSIO_API_KEY)


def _custom_credentials(toolkit: str) -> dict | None:
    """Bring-your-own OAuth creds for a toolkit's provider, or None (→ managed).

    When present, the connection is white-labeled: the provider consent screen
    shows the platform's own app ("Easy Life"), never Composio.
    """
    google = ("gmail", "googlecalendar", "googledrive", "googledocs", "google_search_console")
    if toolkit in google and settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET:
        return {"client_id": settings.GOOGLE_OAUTH_CLIENT_ID, "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET}
    if toolkit in ("instagram", "facebook") and settings.META_APP_ID and settings.META_APP_SECRET:
        return {"client_id": settings.META_APP_ID, "client_secret": settings.META_APP_SECRET}
    if toolkit == "slack" and settings.SLACK_OAUTH_CLIENT_ID and settings.SLACK_OAUTH_CLIENT_SECRET:
        return {"client_id": settings.SLACK_OAUTH_CLIENT_ID, "client_secret": settings.SLACK_OAUTH_CLIENT_SECRET}
    if toolkit == "shopify" and settings.SHOPIFY_OAUTH_CLIENT_ID and settings.SHOPIFY_OAUTH_CLIENT_SECRET:
        return {"client_id": settings.SHOPIFY_OAUTH_CLIENT_ID, "client_secret": settings.SHOPIFY_OAUTH_CLIENT_SECRET}
    return None


def _headers() -> dict:
    return {"x-api-key": settings.COMPOSIO_API_KEY, "Content-Type": "application/json"}


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=settings.COMPOSIO_BASE_URL, timeout=_TIMEOUT, headers=_headers())


async def ensure_auth_config(toolkit: str) -> str:
    """Return the auth_config id for a toolkit.

    Uses a WHITE-LABELED custom config when the provider's OAuth creds are set
    (consent shows "Easy Life"), else a Composio-managed one. Reuses an existing
    config of the matching kind; caches per process.
    """
    creds = _custom_credentials(toolkit)
    want_managed = creds is None
    cache_key = f"{toolkit}:{'managed' if want_managed else 'custom'}"
    if cache_key in _AUTH_CONFIG_CACHE:
        return _AUTH_CONFIG_CACHE[cache_key]

    async with _client() as c:
        # reuse an existing config of the matching kind (managed vs custom)
        r = await c.get("/auth_configs", params={"toolkit_slug": toolkit})
        if r.status_code < 300:
            for it in r.json().get("items", []):
                tk = it.get("toolkit")
                tk_slug = tk.get("slug") if isinstance(tk, dict) else tk
                if tk_slug == toolkit and it.get("id") and bool(it.get("is_composio_managed")) == want_managed:
                    _AUTH_CONFIG_CACHE[cache_key] = it["id"]
                    return it["id"]

        if want_managed:
            body = {"toolkit": {"slug": toolkit}, "auth_config": {"type": "use_composio_managed_auth"}}
        else:
            body = {
                "toolkit": {"slug": toolkit},
                "auth_config": {
                    "type": "use_custom_auth",
                    "authScheme": "OAUTH2",
                    "credentials": creds,
                },
            }
        r = await c.post("/auth_configs", json=body)
        r.raise_for_status()
        ac_id = r.json()["auth_config"]["id"]
        _AUTH_CONFIG_CACHE[cache_key] = ac_id
        return ac_id


async def initiate_connection(tenant_id: str, toolkit: str) -> dict:
    """Start a per-tenant OAuth connection. Returns {redirect_url, connected_account_id}."""
    ac_id = await ensure_auth_config(toolkit)
    async with _client() as c:
        r = await c.post(
            "/connected_accounts/link",
            json={"auth_config_id": ac_id, "user_id": tenant_id},
        )
        r.raise_for_status()
        d = r.json()
        return {
            "redirect_url": d.get("redirect_url"),
            "connected_account_id": d.get("connected_account_id"),
        }


async def live_statuses(tenant_id: str) -> dict[str, dict]:
    """toolkit slug -> {connected, status, account_id} for THIS tenant."""
    if not configured():
        return {}
    try:
        async with _client() as c:
            r = await c.get("/connected_accounts", params={"user_ids": tenant_id})
            r.raise_for_status()
            items = r.json().get("items", [])
    except Exception:
        logger.exception("composio live_statuses failed")
        return {}
    out: dict[str, dict] = {}
    for it in items:
        tk = it.get("toolkit")
        toolkit = tk.get("slug") if isinstance(tk, dict) else tk
        slug = SLUG_BY_TOOLKIT.get(toolkit)
        if not slug:
            continue
        active = str(it.get("status", "")).upper() == "ACTIVE"
        prev = out.get(slug)
        if prev and prev["connected"] and not active:
            continue
        out[slug] = {"connected": active, "status": it.get("status"), "account_id": it.get("id")}
    return out


async def disconnect(connected_account_id: str) -> bool:
    if not configured():
        return True
    try:
        async with _client() as c:
            r = await c.delete(f"/connected_accounts/{connected_account_id}")
            return r.status_code < 300
    except Exception:
        logger.exception("composio disconnect failed")
        return False
