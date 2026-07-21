"""Minimal MCP client for Composio's hosted server.

The account we have is an MCP consumer key (x-consumer-api-key) — NOT a REST
project key — so the backend talks to Composio over MCP (JSON-RPC / streamable
HTTP at connect.composio.dev/mcp) instead of the REST API. This module does the
initialize handshake and exposes `call_tool()` for the Composio meta-tools
(COMPOSIO_MANAGE_CONNECTIONS, COMPOSIO_SEARCH_TOOLS, ...).

Discovered + verified live: header `x-consumer-api-key`, protocol 2025-06-18,
tools/list returns the 7 COMPOSIO_* meta-tools.
"""

from __future__ import annotations

import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger("easylife.connections.composio_mcp")

MCP_URL = "https://connect.composio.dev/mcp"
_PROTOCOL = "2025-06-18"
_TIMEOUT = httpx.Timeout(60.0)


def configured() -> bool:
    return bool(settings.COMPOSIO_API_KEY)


def _parse(resp: httpx.Response) -> dict:
    """Composio replies as SSE (text/event-stream) or JSON — normalize to dict."""
    if "text/event-stream" in resp.headers.get("content-type", ""):
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                try:
                    return json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
        return {}
    try:
        return resp.json()
    except json.JSONDecodeError:
        return {}


class ComposioMCPError(RuntimeError):
    pass


async def call_tool(name: str, arguments: dict) -> dict:
    """Full stateless MCP round-trip: initialize → initialized → tools/call.

    Returns the parsed JSON payload the Composio meta-tool produced (its text
    content decoded), or raises ComposioMCPError.
    """
    if not configured():
        raise ComposioMCPError("composio_not_configured")

    base = {
        "x-consumer-api-key": settings.COMPOSIO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        init = await c.post(
            MCP_URL,
            headers=base,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": _PROTOCOL,
                    "capabilities": {},
                    "clientInfo": {"name": "easylife", "version": "1.0"},
                },
            },
        )
        session_id = init.headers.get("mcp-session-id")
        if init.status_code >= 300 or not session_id:
            raise ComposioMCPError(f"initialize failed: {init.status_code}")
        h = {**base, "Mcp-Session-Id": session_id}
        # notifications/initialized (fire and forget)
        await c.post(MCP_URL, headers=h, json={"jsonrpc": "2.0", "method": "notifications/initialized"})

        call = await c.post(
            MCP_URL,
            headers=h,
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments},
            },
        )
        data = _parse(call)
        if not isinstance(data, dict) or "result" not in data:
            err = data.get("error") if isinstance(data, dict) else None
            raise ComposioMCPError(f"tool call failed: {err or call.status_code}")
        return _extract_payload(data["result"])


def _extract_payload(result: dict) -> dict:
    """MCP tool result -> the JSON the tool actually returned (in text content)."""
    if isinstance(result, dict) and "structuredContent" in result and result["structuredContent"]:
        return result["structuredContent"]
    content = result.get("content", []) if isinstance(result, dict) else []
    for block in content:
        if block.get("type") == "text":
            text = block.get("text", "")
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"text": text}
    return {"raw": result}
