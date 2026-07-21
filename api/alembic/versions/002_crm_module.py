"""crm module — accounts, deals, tickets, activities + extend tasks

Revision ID: 002
Revises: 001
Create Date: 2026-07-21

Adds the Fireberry-parity CRM tables and extends the existing tasks table with
description / priority / account_id / deal_id / assignee_user_id.

Portable across sqlite (unit tests) and postgres (dev/prod). New task columns
are added inside a batch_alter_table block so sqlite (which cannot ALTER a
column to add a FK in place) rebuilds the table cleanly.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
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
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="business"),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("industry", sa.String(128), nullable=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("tags", _json(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("custom", _json(), nullable=False, server_default="{}"),
        _created_at(),
    )

    op.create_table(
        "deals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "contact_id",
            sa.Uuid(),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("pipeline", sa.String(32), nullable=False, server_default="sales"),
        sa.Column("stage", sa.String(16), nullable=False, server_default="lead", index=True),
        sa.Column("value_agorot", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="ILS"),
        sa.Column("expected_close", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("source_channel", sa.String(32), nullable=True),
        sa.Column("custom", _json(), nullable=False, server_default="{}"),
        _created_at(),
    )

    op.create_table(
        "tickets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="new", index=True),
        sa.Column("priority", sa.String(16), nullable=False, server_default="normal"),
        sa.Column(
            "contact_id",
            sa.Uuid(),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("channel_kind", sa.String(32), nullable=True),
        sa.Column("assignee_user_id", sa.Uuid(), nullable=True),
        _created_at(),
    )

    op.create_table(
        "activities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant_fk(),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "contact_id",
            sa.Uuid(),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "deal_id",
            sa.Uuid(),
            sa.ForeignKey("deals.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, index=True),
        _created_at(),
    )

    # Extend the existing tasks table. batch mode makes this safe on sqlite;
    # sqlite requires FK constraints added via batch to be explicitly named.
    with op.batch_alter_table("tasks", schema=None) as batch:
        batch.add_column(sa.Column("description", sa.Text(), nullable=True))
        batch.add_column(
            sa.Column("priority", sa.String(16), nullable=False, server_default="normal")
        )
        batch.add_column(
            sa.Column(
                "account_id",
                sa.Uuid(),
                sa.ForeignKey(
                    "accounts.id", ondelete="SET NULL", name="fk_tasks_account_id"
                ),
                nullable=True,
            )
        )
        batch.add_column(
            sa.Column(
                "deal_id",
                sa.Uuid(),
                sa.ForeignKey("deals.id", ondelete="SET NULL", name="fk_tasks_deal_id"),
                nullable=True,
            )
        )
        batch.add_column(sa.Column("assignee_user_id", sa.Uuid(), nullable=True))

    # Match the model: tasks.status is indexed for the ?status= filter.
    op.create_index("ix_tasks_status", "tasks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_tasks_status", table_name="tasks")
    with op.batch_alter_table("tasks", schema=None) as batch:
        batch.drop_column("assignee_user_id")
        batch.drop_column("deal_id")
        batch.drop_column("account_id")
        batch.drop_column("priority")
        batch.drop_column("description")

    for table in ("activities", "tickets", "deals", "accounts"):
        op.drop_table(table)
