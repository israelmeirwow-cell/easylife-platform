"""brain schema — all 14 tables + pgvector + events pg_notify trigger

Revision ID: 001
Revises:
Create Date: 2026-07-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json():
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _tenant_fk():
    return sa.Column(
        "tenant_id",
        sa.Uuid(),
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


def _created_at():
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        from pgvector.sqlalchemy import Vector

        embedding_type = Vector(1024)
    else:
        embedding_type = sa.JSON()

    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(32), nullable=False, server_default="trial"),
        sa.Column("settings", _json(), nullable=False, server_default="{}"),
        _created_at(),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(1024), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        _tenant_fk(),
        sa.Column("role", sa.String(16), nullable=False, server_default="staff"),
        sa.Column("wa_phone", sa.String(32), nullable=True),
        sa.Column("push_subscription", _json(), nullable=True),
        _created_at(),
    )

    op.create_table(
        "channels",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="disconnected"),
        sa.Column("credentials_encrypted", sa.Text(), nullable=True),
        sa.Column("meta", _json(), nullable=False, server_default="{}"),
        _created_at(),
    )

    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("phones", _json(), nullable=False, server_default="[]"),
        sa.Column("emails", _json(), nullable=False, server_default="[]"),
        sa.Column("handles", _json(), nullable=False, server_default="{}"),
        sa.Column("tags", _json(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("custom", _json(), nullable=False, server_default="{}"),
        _created_at(),
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column(
            "contact_id",
            sa.Uuid(),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "channel_id",
            sa.Uuid(),
            sa.ForeignKey("channels.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("assignee", sa.String(16), nullable=False, server_default="agent"),
        sa.Column("last_msg_at", sa.DateTime(timezone=True), nullable=True),
        _created_at(),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column(
            "conversation_id",
            sa.Uuid(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("sender_type", sa.String(16), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("media", _json(), nullable=False, server_default="{}"),
        sa.Column("channel_msg_id", sa.String(255), nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False, index=True),
        _created_at(),
    )

    op.create_table(
        "leads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column(
            "contact_id",
            sa.Uuid(),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("stage", sa.String(16), nullable=False, server_default="new", index=True),
        sa.Column("value_agorot", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_channel", sa.String(32), nullable=True),
        sa.Column("owner", sa.String(255), nullable=True),
        _created_at(),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column(
            "contact_id",
            sa.Uuid(),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        _created_at(),
    )

    op.create_table(
        "approvals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("requested_by_agent", sa.String(64), nullable=False),
        sa.Column("action_type", sa.String(64), nullable=False),
        sa.Column("payload", _json(), nullable=False, server_default="{}"),
        sa.Column("preview_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending", index=True),
        sa.Column("decided_by", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", _json(), nullable=True),
        _created_at(),
    )

    op.create_table(
        "events",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            primary_key=True,
            autoincrement=True,
        ),
        _tenant_fk(),
        sa.Column("actor_type", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.String(64), nullable=True),
        sa.Column("verb", sa.String(64), nullable=False, index=True),
        sa.Column("entity_type", sa.String(32), nullable=True),
        sa.Column("entity_id", sa.String(64), nullable=True),
        sa.Column("payload", _json(), nullable=False, server_default="{}"),
        sa.Column(
            "ts", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True
        ),
        _created_at(),
    )

    op.create_table(
        "memories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("scope", sa.String(16), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", embedding_type, nullable=True),
        sa.Column("source_event_id", sa.BigInteger(), nullable=True),
        sa.Column("importance", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _created_at(),
    )

    op.create_table(
        "agent_configs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("agent_kind", sa.String(64), nullable=False),
        sa.Column("config", _json(), nullable=False, server_default="{}"),
        sa.Column("guardrails", _json(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        _created_at(),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("source_channel", sa.String(32), nullable=True),
        sa.Column("amount_agorot", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="ILS"),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _created_at(),
    )

    op.create_table(
        "usage_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("model", sa.String(64), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd_micros", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _created_at(),
    )

    if is_postgres:
        # Event flow: INSERT INTO events -> pg_notify('events', tenant_id) ->
        # (a) SSE hub, (b) agent dispatcher (RQ).
        op.execute(
            """
            CREATE OR REPLACE FUNCTION notify_event() RETURNS trigger AS $$
            BEGIN
                PERFORM pg_notify('events', NEW.tenant_id::text);
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER events_notify
            AFTER INSERT ON events
            FOR EACH ROW EXECUTE FUNCTION notify_event();
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("DROP TRIGGER IF EXISTS events_notify ON events")
        op.execute("DROP FUNCTION IF EXISTS notify_event()")

    for table in (
        "usage_events",
        "documents",
        "agent_configs",
        "memories",
        "events",
        "approvals",
        "tasks",
        "leads",
        "messages",
        "conversations",
        "contacts",
        "channels",
        "users",
        "tenants",
    ):
        op.drop_table(table)
