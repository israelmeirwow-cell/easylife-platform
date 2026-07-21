"""Connections — catalog, demo-mode connect (no Composio key), disconnect, isolation."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import Channel


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_catalog_lists_apps(client):
    r = await client.get("/api/connections/catalog")
    assert r.status_code == 200, r.text
    data = r.json()
    slugs = {a["slug"] for a in data["apps"]}
    assert {"whatsapp", "instagram", "facebook", "tiktok", "gmail"} <= slugs
    # whatsapp is native (our own), instagram is composio
    by = {a["slug"]: a for a in data["apps"]}
    assert by["whatsapp"]["provider"] == "native"
    assert by["instagram"]["provider"] == "composio"
    assert data["composio_configured"] is False  # no key in tests


async def test_native_connect_returns_native_mode(client):
    r = await client.post("/api/connections/whatsapp/connect")
    assert r.status_code == 200
    assert r.json()["mode"] == "native"


async def test_demo_connect_and_disconnect(client):
    r = await client.post("/api/connections/instagram/connect")
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "demo"
    cid = body["channel_id"]

    # now shows as connected in the catalog + connections list
    cat = (await client.get("/api/connections/catalog")).json()
    insta = next(a for a in cat["apps"] if a["slug"] == "instagram")
    assert insta["connected"] is True

    listing = (await client.get("/api/connections")).json()
    assert any(c["id"] == cid for c in listing)

    # disconnect
    d = await client.post(f"/api/connections/{cid}/disconnect")
    assert d.status_code == 200
    listing2 = (await client.get("/api/connections")).json()
    assert not any(c["id"] == cid for c in listing2)


async def test_unknown_app_404(client):
    r = await client.post("/api/connections/nosuchapp/connect")
    assert r.status_code == 404


async def test_connections_are_tenant_isolated(session, demo_tenant):
    # a connection for the demo tenant must not leak to another tenant's list
    from app.models import Tenant

    other = Tenant(name="עסק אחר בע\"מ", plan="demo")
    session.add(other)
    session.add(Channel(tenant_id=demo_tenant.id, kind="instagram", status="demo_connected", meta={}))
    await session.commit()

    from app.routers.connections import _tenant_channels

    other_map = await _tenant_channels(session, other.id)
    assert "instagram" not in other_map
