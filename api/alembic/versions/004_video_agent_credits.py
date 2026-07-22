"""video agent tables + prepaid credit engine

Revision ID: 004
Revises: 003
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "video_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("brief", sa.Text(), nullable=False),
        sa.Column("product_ref", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="draft", index=True),
        sa.Column("scene_plan", sa.JSON(), nullable=True),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("final_video_url", sa.String(1024), nullable=True),
        sa.Column("thumbnail_url", sa.String(1024), nullable=True),
        sa.Column("srt_url", sa.String(1024), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "video_scenes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "job_id",
            sa.Uuid(),
            sa.ForeignKey("video_jobs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending", index=True),
        sa.Column("keyframe_url", sa.String(1024), nullable=True),
        sa.Column("video_url", sa.String(1024), nullable=True),
        sa.Column("spritesheet_url", sa.String(1024), nullable=True),
        sa.Column("provider", sa.String(32), nullable=False, server_default="higgsfield"),
        sa.Column("provider_request_id", sa.String(255), nullable=True, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("critic_score", sa.Float(), nullable=True),
        sa.Column("critic_weak_spots", sa.JSON(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "credit_topups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("credits_total", sa.Integer(), nullable=False),
        sa.Column("credits_consumed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(32), nullable=False, server_default="purchase"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "credit_ledger",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "job_id",
            sa.Uuid(),
            sa.ForeignKey("video_jobs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "scene_id",
            sa.Uuid(),
            sa.ForeignKey("video_scenes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("operation", sa.String(32), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("credits_from_plan", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credits_from_topup", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("topup_allocations", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="reserved", index=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_cost_usd_micros", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    # The balance query: sum(credits_from_plan) per tenant+period over live rows.
    op.create_index(
        "ix_credit_ledger_tenant_period",
        "credit_ledger",
        ["tenant_id", "period_end", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_credit_ledger_tenant_period", table_name="credit_ledger")
    op.drop_table("credit_ledger")
    op.drop_table("credit_topups")
    op.drop_table("video_scenes")
    op.drop_table("video_jobs")
