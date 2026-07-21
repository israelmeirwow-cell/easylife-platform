"""SQLAlchemy 2 models for the 14 brain tables (CLAUDE.md "Brain schema").

Portability rules (unit tests run on sqlite, dev/prod on postgres):
- UUID pks via sa.Uuid (native uuid on postgres, CHAR(32) on sqlite) — except
  events.id which is BIGSERIAL (append-only timeline, naturally ordered).
- jsonb columns + arrays (phones, emails, tags) use JSON with a JSONB variant
  on postgres.
- memories.embedding: pgvector Vector(1024) on postgres, JSON on sqlite.
- Money: integer agorot (amount_agorot / value_agorot); LLM costs in integer
  USD micros (cost_usd_micros).
- Timestamps: timezone-aware UTC (displayed Asia/Jerusalem in the UI).
"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, TypeDecorator

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# JSONB on postgres, plain JSON elsewhere.
JSONVariant = JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

# BIGSERIAL on postgres; sqlite needs INTEGER PRIMARY KEY for autoincrement.
BigIntPK = BigInteger().with_variant(Integer(), "sqlite")


class EmbeddingVector(TypeDecorator):
    """pgvector Vector(dim) on postgres, JSON list-of-floats fallback on sqlite."""

    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = 1024, **kwargs):
        self.dim = dim
        super().__init__(**kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(JSON())


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)


def tenant_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )


def created_at_col() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=sa.func.now()
    )


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="trial")
    settings: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_col()


class User(SQLAlchemyBaseUserTableUUID, Base):
    """fastapi-users base (id/email/hashed_password/is_*) + brain fields."""

    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="staff")  # owner|staff
    wa_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    push_subscription: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    created_at: Mapped[datetime] = created_at_col()


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    # whatsapp|instagram|facebook|email|woocommerce|shopify|grow|greeninvoice
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="disconnected")
    credentials_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet
    meta: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_col()


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phones: Mapped[list] = mapped_column(JSONVariant, nullable=False, default=list)
    emails: Mapped[list] = mapped_column(JSONVariant, nullable=False, default=list)
    handles: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    tags: Mapped[list] = mapped_column(JSONVariant, nullable=False, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_col()


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("channels.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")  # open|pending|closed
    assignee: Mapped[str] = mapped_column(String(16), nullable=False, default="agent")  # agent|human
    last_msg_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = created_at_col()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # in|out
    sender_type: Mapped[str] = mapped_column(String(16), nullable=False)  # contact|agent|human
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    media: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    channel_msg_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )
    created_at: Mapped[datetime] = created_at_col()


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    stage: Mapped[str] = mapped_column(
        String(16), nullable=False, default="new", index=True
    )  # new|contacted|qualified|won|lost
    value_agorot: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = created_at_col()


class Account(Base):
    """CRM company/person record (Fireberry "Account")."""

    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="business")  # business|person
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    tags: Mapped[list] = mapped_column(JSONVariant, nullable=False, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_col()


class Deal(Base):
    """CRM opportunity moving through a pipeline (Fireberry "Deal")."""

    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    pipeline: Mapped[str] = mapped_column(String(32), nullable=False, default="sales")
    # lead|qualified|proposal|negotiation|won|lost
    stage: Mapped[str] = mapped_column(String(16), nullable=False, default="lead", index=True)
    value_agorot: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="ILS")
    expected_close: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    source_channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    custom: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_col()


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="open", index=True
    )  # open|in_progress|done
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")  # low|normal|high
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("deals.id", ondelete="SET NULL"), nullable=True
    )
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)  # user id
    created_at: Mapped[datetime] = created_at_col()


class Ticket(Base):
    """CRM support ticket (Fireberry "Ticket / Case")."""

    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # new|open|pending|resolved|closed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new", index=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")  # low|normal|high|urgent
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    channel_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    created_at: Mapped[datetime] = created_at_col()


class Activity(Base):
    """CRM logged interaction: call/meeting/note/email/whatsapp (Fireberry "Activity")."""

    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # call|meeting|note|email|whatsapp
    body: Mapped[str] = mapped_column(Text, nullable=False)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("deals.id", ondelete="SET NULL"), index=True, nullable=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )
    created_at: Mapped[datetime] = created_at_col()


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    requested_by_agent: Mapped[str] = mapped_column(String(64), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # pending -> approved -> executed|failed ; pending -> rejected ; pending -> expired
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", index=True)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)  # user id
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    created_at: Mapped[datetime] = created_at_col()


# Valid approval state machine transitions — every transition emits an event.
APPROVAL_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"approved", "rejected", "expired"},
    "approved": {"executed", "failed"},
}

# CRM enums (validated at the schema layer; kept here so seed + routers agree).
DEAL_STAGES: tuple[str, ...] = ("lead", "qualified", "proposal", "negotiation", "won", "lost")
DEAL_OPEN_STAGES: tuple[str, ...] = ("lead", "qualified", "proposal", "negotiation")
TASK_STATUSES: tuple[str, ...] = ("open", "in_progress", "done")
TICKET_STATUSES: tuple[str, ...] = ("new", "open", "pending", "resolved", "closed")
TICKET_OPEN_STATUSES: tuple[str, ...] = ("new", "open", "pending")
ACTIVITY_KINDS: tuple[str, ...] = ("call", "meeting", "note", "email", "whatsapp")


class Event(Base):
    """APPEND-ONLY timeline. Never update, never delete."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)  # agent|human|system|contact
    actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verb: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # entity.verb
    entity_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=sa.func.now(), index=True
    )
    created_at: Mapped[datetime] = created_at_col()


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    scope: Mapped[str] = mapped_column(String(16), nullable=False)  # contact|business|global
    entity_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list | None] = mapped_column(EmbeddingVector(1024), nullable=True)
    source_event_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    importance: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    created_at: Mapped[datetime] = created_at_col()


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    agent_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    config: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    guardrails: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")  # draft|active|paused
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = created_at_col()


class Document(Base):
    """Cash-flow feed rows: invoices / receipts / orders."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # invoice|receipt|order
    source_channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    amount_agorot: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="ILS")
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # in|out
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    created_at: Mapped[datetime] = created_at_col()


class UsageEvent(Base):
    """Metering/quotas/billing for platform-owned AI keys."""

    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # llm|transcription|embedding
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd_micros: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    created_at: Mapped[datetime] = created_at_col()



class Finding(Base):
    """CEO analyst output — one detected, deduped, actionable business insight.

    Numbers live in `metrics` (computed deterministically by the analyst);
    `summary_he` is a template-rendered sentence containing the exact numbers.
    The LLM never writes rows here — it only phrases the brief that CITES them.
    """

    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = tenant_fk()
    analyst: Mapped[str] = mapped_column(String(32), nullable=False)  # registry kind
    kind: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. pipeline.stalled_deal
    severity: Mapped[str] = mapped_column(String(16), nullable=False)  # critical|high|medium|low|info
    title_he: Mapped[str] = mapped_column(String(200), nullable=False)
    summary_he: Mapped[str] = mapped_column(Text, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    evidence: Mapped[list] = mapped_column(JSONVariant, nullable=False, default=list)
    recommendation: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    falsifiability: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    window_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    window_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="open"
    )  # open|acknowledged|acted|resolved|dismissed|falsified|expired
    outcome: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    created_at: Mapped[datetime] = created_at_col()
