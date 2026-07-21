"""Tasks: list (filter status/assignee) / create / patch.

PATCH to status=done emits task.completed; any other change emits task.updated.
Creation emits task.created. Writes share the row's transaction.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import optional_current_user
from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import Task, User
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def _get_task_or_404(
    session: AsyncSession, tenant_id: uuid.UUID, task_id: uuid.UUID
) -> Task:
    result = await session.execute(
        select(Task).where(Task.tenant_id == tenant_id, Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    status: str | None = Query(None),
    assignee: uuid.UUID | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[Task]:
    query = select(Task).where(Task.tenant_id == tenant_id)
    if status is not None:
        query = query.where(Task.status == status)
    if assignee is not None:
        query = query.where(Task.assignee_user_id == assignee)
    result = await session.execute(query.order_by(Task.created_at.desc()).limit(limit))
    return list(result.scalars().all())


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(
    body: TaskCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    user: User | None = Depends(optional_current_user),
    session: AsyncSession = Depends(get_session),
) -> Task:
    task = Task(
        tenant_id=tenant_id,
        created_by=user.id if user is not None else None,
        **body.model_dump(),
    )
    session.add(task)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="task.created",
        entity_type="task",
        entity_id=task.id,
        payload={
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "contact_id": str(task.contact_id) if task.contact_id else None,
            "account_id": str(task.account_id) if task.account_id else None,
            "deal_id": str(task.deal_id) if task.deal_id else None,
        },
    )
    await session.commit()
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> Task:
    task = await _get_task_or_404(session, tenant_id, task_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return task

    old_status = task.status
    for field, value in changes.items():
        setattr(task, field, value)

    became_done = task.status == "done" and old_status != "done"
    verb = "task.completed" if became_done else "task.updated"
    payload: dict = {
        "title": task.title,
        "status": task.status,
        "contact_id": str(task.contact_id) if task.contact_id else None,
        "account_id": str(task.account_id) if task.account_id else None,
        "deal_id": str(task.deal_id) if task.deal_id else None,
    }
    if not became_done:
        payload["fields"] = sorted(changes.keys())

    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb=verb,
        entity_type="task",
        entity_id=task.id,
        payload=payload,
    )
    await session.commit()
    return task
