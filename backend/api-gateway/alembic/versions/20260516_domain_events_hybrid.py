"""Append-only domain_events log for hybrid event-driven layer (parallel to CRUD)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "domain_events_hybrid_v1"
down_revision: str | None = "business_os_foundation_v1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "domain_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("actor", sa.String(20), nullable=False),
        sa.Column("target_id", sa.String(64), nullable=False),
        sa.Column("target_kind", sa.String(40), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("occurred_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_domain_events_org_type", "domain_events", ["organization_id", "event_type"])
    op.create_index("ix_domain_events_org_target", "domain_events", ["organization_id", "target_id"])
    op.create_index("ix_domain_events_org_occurred", "domain_events", ["organization_id", "occurred_at_ms"])


def downgrade() -> None:
    op.drop_index("ix_domain_events_org_occurred", table_name="domain_events")
    op.drop_index("ix_domain_events_org_target", table_name="domain_events")
    op.drop_index("ix_domain_events_org_type", table_name="domain_events")
    op.drop_table("domain_events")
