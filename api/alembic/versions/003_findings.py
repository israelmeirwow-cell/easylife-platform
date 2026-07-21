"""findings table — CEO analyst output

Revision ID: 003
Revises: 002
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "findings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("analyst", sa.String(32), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title_he", sa.String(200), nullable=False),
        sa.Column("summary_he", sa.Text(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("recommendation", sa.JSON(), nullable=True),
        sa.Column("falsifiability", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("window_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dedupe_key", sa.String(64), nullable=False, index=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("outcome", sa.JSON(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    # one OPEN finding per (tenant, dedupe_key) — re-runs bump last_seen_at
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE UNIQUE INDEX uq_findings_open_dedupe "
            "ON findings (tenant_id, dedupe_key) WHERE status = 'open'"
        )
    else:  # sqlite supports partial indexes too
        op.execute(
            "CREATE UNIQUE INDEX uq_findings_open_dedupe "
            "ON findings (tenant_id, dedupe_key) WHERE status = 'open'"
        )


def downgrade() -> None:
    op.drop_index("uq_findings_open_dedupe", table_name="findings")
    op.drop_table("findings")
