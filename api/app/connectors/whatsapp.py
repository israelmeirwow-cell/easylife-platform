"""WhatsApp Cloud API connector — outbound (stage A).

Sends messages via Meta's Graph API using a phone_number_id + access token.
For now the single test number's creds come from settings; the multi-tenant
version will pass per-channel creds (stored Fernet-encrypted on `channels`).

Note: a WhatsApp *test* number (and any number outside a 24h customer-service
window) can only deliver TEMPLATE messages. Free-form `send_text` works only
after the customer has messaged you (opening the 24h window).
"""

from __future__ import annotations

import httpx

from app.config import settings

GRAPH = "https://graph.facebook.com"


class WhatsAppError(RuntimeError):
    """Raised when the Cloud API returns an error response."""


def _endpoint(phone_number_id: str) -> str:
    return f"{GRAPH}/{settings.WHATSAPP_API_VERSION}/{phone_number_id}/messages"


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _post(
    payload: dict,
    *,
    phone_number_id: str | None = None,
    token: str | None = None,
) -> dict:
    phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
    token = token or settings.WHATSAPP_ACCESS_TOKEN
    if not phone_number_id or not token:
        raise WhatsAppError(
            "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing — set them in api/.env"
        )
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(_endpoint(phone_number_id), headers=_headers(token), json=payload)
    data = resp.json()
    if resp.status_code >= 400:
        raise WhatsAppError(f"HTTP {resp.status_code}: {data.get('error', data)}")
    return data


async def send_template(
    to: str,
    name: str = "hello_world",
    lang: str = "en_US",
    **creds,
) -> dict:
    """Send a pre-approved template message (works anytime, incl. test numbers)."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": name, "language": {"code": lang}},
    }
    return await _post(payload, **creds)


async def send_text(to: str, body: str, **creds) -> dict:
    """Send a free-form text — only inside a 24h window opened by an inbound msg."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }
    return await _post(payload, **creds)
