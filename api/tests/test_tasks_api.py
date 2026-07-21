"""Tasks API: create -> list (status/assignee) -> patch (updated/completed) + events."""

import uuid

from sqlalchemy import select

from app.models import Event


async def _make_task(client, **kwargs):
    payload = {"title": "להתקשר ללקוח"}
    payload.update(kwargs)
    response = await client.post("/api/tasks", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_task_emits_event(client, session, demo_tenant):
    task = await _make_task(client, title="לשלוח קטלוג", priority="high")
    assert task["status"] == "open"
    assert task["priority"] == "high"

    event = (
        await session.execute(select(Event).where(Event.verb == "task.created"))
    ).scalars().one()
    assert event.entity_id == task["id"]
    assert event.tenant_id == demo_tenant.id


async def test_list_tasks_status_filter(client):
    await _make_task(client, status="open")
    await _make_task(client, status="done")

    open_tasks = await client.get("/api/tasks", params={"status": "open"})
    assert len(open_tasks.json()) == 1
    assert open_tasks.json()[0]["status"] == "open"


async def test_list_tasks_assignee_filter(client):
    assignee = str(uuid.uuid4())
    await _make_task(client, assignee_user_id=assignee)
    await _make_task(client)

    mine = await client.get("/api/tasks", params={"assignee": assignee})
    assert len(mine.json()) == 1
    assert mine.json()[0]["assignee_user_id"] == assignee


async def test_patch_to_done_emits_completed(client, session):
    task = await _make_task(client, status="open")
    response = await client.patch(f"/api/tasks/{task['id']}", json={"status": "done"})
    assert response.status_code == 200
    assert response.json()["status"] == "done"

    completed = (
        await session.execute(select(Event).where(Event.verb == "task.completed"))
    ).scalars().all()
    assert len(completed) == 1
    assert completed[0].entity_id == task["id"]


async def test_patch_other_field_emits_updated(client, session):
    task = await _make_task(client, status="open")
    response = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "in_progress", "priority": "high"}
    )
    assert response.status_code == 200

    updated = (
        await session.execute(select(Event).where(Event.verb == "task.updated"))
    ).scalars().all()
    assert len(updated) == 1
    assert set(updated[0].payload["fields"]) == {"status", "priority"}
    # not done -> no completed event
    completed = (
        await session.execute(select(Event).where(Event.verb == "task.completed"))
    ).scalars().all()
    assert completed == []


async def test_patch_unknown_task_404(client):
    response = await client.patch(f"/api/tasks/{uuid.uuid4()}", json={"status": "done"})
    assert response.status_code == 404
