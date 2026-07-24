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
    preview: str | None = None
    channel_kind: str | None = None


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


# --- CRM: Accounts ---------------------------------------------------------


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: str
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    industry: str | None = None
    owner_user_id: uuid.UUID | None = None
    tags: list
    notes: str | None = None
    custom: dict
    created_at: datetime


class AccountCreate(BaseModel):
    name: str
    kind: Literal["business", "person"] = "business"
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    industry: str | None = None
    owner_user_id: uuid.UUID | None = None
    tags: list = []
    notes: str | None = None
    custom: dict = {}


class AccountUpdate(BaseModel):
    name: str | None = None
    kind: Literal["business", "person"] | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    industry: str | None = None
    owner_user_id: uuid.UUID | None = None
    tags: list | None = None
    notes: str | None = None
    custom: dict | None = None


# --- CRM: Deals ------------------------------------------------------------


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    account_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    pipeline: str
    stage: str
    value_agorot: int
    currency: str
    expected_close: datetime | None = None
    owner_user_id: uuid.UUID | None = None
    source_channel: str | None = None
    custom: dict
    created_at: datetime


class DealCreate(BaseModel):
    title: str
    account_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    pipeline: str = "sales"
    stage: Literal["lead", "qualified", "proposal", "negotiation", "won", "lost"] = "lead"
    value_agorot: int = 0
    currency: str = "ILS"
    expected_close: datetime | None = None
    owner_user_id: uuid.UUID | None = None
    source_channel: str | None = None
    custom: dict = {}


class DealUpdate(BaseModel):
    title: str | None = None
    account_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    pipeline: str | None = None
    stage: Literal["lead", "qualified", "proposal", "negotiation", "won", "lost"] | None = None
    value_agorot: int | None = None
    currency: str | None = None
    expected_close: datetime | None = None
    owner_user_id: uuid.UUID | None = None
    source_channel: str | None = None
    custom: dict | None = None


# --- CRM: Tasks ------------------------------------------------------------


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    due_at: datetime | None = None
    status: str
    priority: str
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    assignee_user_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    due_at: datetime | None = None
    status: Literal["open", "in_progress", "done"] = "open"
    priority: Literal["low", "normal", "high"] = "normal"
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    assignee_user_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    status: Literal["open", "in_progress", "done"] | None = None
    priority: Literal["low", "normal", "high"] | None = None
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    assignee_user_id: uuid.UUID | None = None


# --- CRM: Tickets ----------------------------------------------------------


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject: str
    body: str | None = None
    status: str
    priority: str
    contact_id: uuid.UUID | None = None
    channel_kind: str | None = None
    assignee_user_id: uuid.UUID | None = None
    created_at: datetime


class TicketCreate(BaseModel):
    subject: str
    body: str | None = None
    status: Literal["new", "open", "pending", "resolved", "closed"] = "new"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    contact_id: uuid.UUID | None = None
    channel_kind: str | None = None
    assignee_user_id: uuid.UUID | None = None


class TicketUpdate(BaseModel):
    subject: str | None = None
    body: str | None = None
    status: Literal["new", "open", "pending", "resolved", "closed"] | None = None
    priority: Literal["low", "normal", "high", "urgent"] | None = None
    contact_id: uuid.UUID | None = None
    channel_kind: str | None = None
    assignee_user_id: uuid.UUID | None = None


# --- CRM: Activities -------------------------------------------------------


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    body: str
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    actor_user_id: uuid.UUID | None = None
    occurred_at: datetime
    created_at: datetime


class ActivityCreate(BaseModel):
    kind: Literal["call", "meeting", "note", "email", "whatsapp"]
    body: str
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    occurred_at: datetime | None = None


# --- CRM: Dashboard --------------------------------------------------------


class DealStageBucket(BaseModel):
    stage: str
    count: int
    value_agorot: int


class DashboardSummary(BaseModel):
    contacts_count: int
    leads_count: int
    open_deals_count: int
    pipeline_value_agorot: int
    deals_by_stage: list[DealStageBucket]
    tasks_open_count: int
    tickets_open_count: int
    won_this_month_agorot: int


class MonthBucket(BaseModel):
    """One calendar month of deal flow (labels are 'YYYY-MM')."""

    month: str
    created_count: int
    won_count: int
    won_agorot: int


class CountBucket(BaseModel):
    key: str
    count: int


class TopDeal(BaseModel):
    id: str
    title: str
    stage: str
    value_agorot: int


class DashboardAnalytics(BaseModel):
    """Rich business analytics for the dashboard (blueprint: detailed, not basic)."""

    monthly: list[MonthBucket]
    leads_funnel: list[CountBucket]
    tickets_by_status: list[CountBucket]
    activity_by_weekday: list[CountBucket]
    top_open_deals: list[TopDeal]
    won_total_agorot: int
    avg_deal_agorot: int
    win_rate_pct: float
