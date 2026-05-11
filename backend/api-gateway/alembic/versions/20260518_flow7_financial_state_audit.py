"""Flow 7: аудит снимков FinancialState."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "flow7_state_audit_v1"
down_revision: str | None = "flow3_collaboration_workspace_v1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "financial_state_audit_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state_fingerprint", sa.String(64), nullable=False),
        sa.Column("previous_fingerprint", sa.String(64), nullable=True),
        sa.Column("previous_state_json", sa.Text(), nullable=True),
        sa.Column("new_state_json", sa.Text(), nullable=False),
        sa.Column("trigger_event", sa.String(80), nullable=False),
        sa.Column("source", sa.String(60), nullable=False, server_default="derivation_engine"),
        sa.Column("actor_type", sa.String(20), nullable=False, server_default="system"),
        sa.Column("actor_user_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(
        "ix_fs_audit_org_created",
        "financial_state_audit_entries",
        ["organization_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_fs_audit_org_created", table_name="financial_state_audit_entries")
    op.drop_table("financial_state_audit_entries")
