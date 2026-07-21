"""Composio adapter — the hidden breadth layer behind Easy Life "חיבורים".

We hold an MCP consumer key (not a REST project key), so this talks to Composio
over MCP (see composio_mcp.py) via the COMPOSIO_MANAGE_CONNECTIONS meta-tool:
  - list   → connected accounts per toolkit
  - add    → an OAuth/redirect link to connect a toolkit
  - remove → disconnect an account

NOTE on tenancy: the MCP consumer key is scoped to ONE Composio account (the
platform owner's), so connections are single-account today — perfect for the
owner's own business + demo. True per-customer multi-tenancy needs a Composio
REST *project* key (developer plan); when that lands, swap this module's calls
for the connected_accounts REST API keyed by user_id=tenant_id. All connection
records still live in our `channels` table so nothing else changes.
"""

from __future__ import annotations

import logging

from app.connections import composio_mcp
from app.connections.catalog import CATALOG

logger = logging.getLogger("easylife.connections.composio")

COMPOSIO_TOOLKITS = [a.toolkit for a in CATALOG if a.provider == "composio" and a.toolkit]


def configured() -> bool:
    return composio_mcp.configured()


async def live_statuses() -> dict[str, dict]:
    """toolkit slug -> {connected, status, account_id} pulled live from Composio."""
    if not configured() or not COMPOSIO_TOOLKITS:
        return {}
    try:
        res = await composio_mcp.call_tool(
            "COMPOSIO_MANAGE_CONNECTIONS",
            {"toolkits": [{"name": t, "action": "list"} for t in COMPOSIO_TOOLKITS]},
        )
    except Exception:
        logger.exception("composio live_statuses failed")
        return {}
    results = (res.get("data") or {}).get("results") or {}
    out: dict[str, dict] = {}
    for tk, info in results.items():
        accounts = info.get("accounts") or []
        active = next((a for a in accounts if a.get("status") == "active"), None)
        out[tk] = {
            "connected": bool(active),
            "status": info.get("status"),
            "account_id": (active or {}).get("id"),
        }
    return out


async def initiate_connection(toolkit: str) -> dict:
    """Return {redirect_url, status} for an OAuth/token connect link."""
    res = await composio_mcp.call_tool(
        "COMPOSIO_MANAGE_CONNECTIONS", {"toolkits": [{"name": toolkit, "action": "add"}]}
    )
    r = ((res.get("data") or {}).get("results") or {}).get(toolkit) or {}
    return {"redirect_url": r.get("redirect_url"), "status": r.get("status")}


async def disconnect(toolkit: str, account_id: str) -> bool:
    try:
        await composio_mcp.call_tool(
            "COMPOSIO_MANAGE_CONNECTIONS",
            {"toolkits": [{"name": toolkit, "action": "remove", "account_id": account_id}]},
        )
        return True
    except Exception:
        logger.exception("composio disconnect failed")
        return False
