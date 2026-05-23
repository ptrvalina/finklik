"""Execution trust pilot: usage analytics events."""

from alembic import op
import sqlalchemy as sa

revision = "execution_trust_pilot_v1"
down_revision = "production_hardening_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pilot_usage_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("event_name", sa.String(64), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_pilot_usage_org_created", "pilot_usage_events", ["organization_id", "created_at"])
    op.create_index("ix_pilot_usage_event", "pilot_usage_events", ["event_name"])


def downgrade() -> None:
    op.drop_index("ix_pilot_usage_event", table_name="pilot_usage_events")
    op.drop_index("ix_pilot_usage_org_created", table_name="pilot_usage_events")
    op.drop_table("pilot_usage_events")
