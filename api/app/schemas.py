"""Pydantic response/request schemas for the API routers."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: uuid.UUID
    actor_type: str
    actor_id: str | None = None
    verb: str
    entity_type: str | None = None
    entity_id: str | None = None
    payload: dict
    ts: datetime


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None = None
    phones: list
    emails: list
    handles: dict
    tags: list
    notes: str | None = None
    custom: dict
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contact_id: uuid.UUID
    stage: str
    value_agorot: int
    source_channel: str | None = None
    owner: str | None = None
    created_at: datetime


class LeadStageUpdate(BaseModel):
    stage: Literal["new", "contacted", "qualified", "won", "lost"]


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contact_id: uuid.UUID
    channel_id: uuid.UUID | None = None
    status: str
    assignee: str
    last_msg_at: datetime | None = None
    created_at: datetime
    contact_name: str | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: str
    sender_type: str
    body: str | None = None
    media: dict
    channel_msg_id: str | None = None
    ts: datetime


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    requested_by_agent: str
    action_type: str
    payload: dict
    preview_text: str | None = None
    status: str
    decided_by: uuid.UUID | None = None
    decided_at: datetime | None = None
    executed_at: datetime | None = None
    result: dict | None = None
    created_at: datetime


class ApprovalDecision(BaseModel):
    decision: Literal["approve", "reject"]
