"""Business OS foundation: entities, cost centers, revenue streams, obligations, reconciliation, workflow, AI memory."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "business_os_foundation_v1"
down_revision: str | None = "cp_created_pg_default"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "business_entities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("entity_type", sa.String(20), nullable=False, server_default="supplier"),
        sa.Column("counterparty_id", sa.String(36), sa.ForeignKey("counterparties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "cost_centers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("center_type", sa.String(30), nullable=False, server_default="other"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "revenue_streams",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "financial_obligations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("obligation_type", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("linked_transaction_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_fin_oblig_org_due", "financial_obligations", ["organization_id", "due_date"])
    op.create_index("ix_fin_oblig_org_status", "financial_obligations", ["organization_id", "status"])

    op.create_table(
        "reconciliation_matches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("transaction_id", sa.String(36), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("scanned_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=False, server_default="0.8"),
        sa.Column("status", sa.String(20), nullable=False, server_default="suggested"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("transaction_id", "document_id", name="uq_recon_tx_doc"),
    )

    op.create_table(
        "workflow_actions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("action_type", sa.String(40), nullable=False),
        sa.Column("target_id", sa.String(36), nullable=False),
        sa.Column("target_kind", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("performed_by_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_workflow_org_created", "workflow_actions", ["organization_id", "created_at"])

    op.create_table(
        "ai_memory_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("memory_type", sa.String(40), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_ai_memory_org_type", "ai_memory_entries", ["organization_id", "memory_type"])

    op.add_column("transactions", sa.Column("cost_center_id", sa.String(36), nullable=True))
    op.add_column("transactions", sa.Column("revenue_stream_id", sa.String(36), nullable=True))
    op.add_column("transactions", sa.Column("ai_analysis_json", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_tx_cost_center",
        "transactions",
        "cost_centers",
        ["cost_center_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tx_revenue_stream",
        "transactions",
        "revenue_streams",
        ["revenue_stream_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "scanned_documents",
        sa.Column("lifecycle_status", sa.String(20), nullable=False, server_default="uploaded"),
    )
    op.add_column("scanned_documents", sa.Column("duplicate_of_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_scanned_dup_of",
        "scanned_documents",
        "scanned_documents",
        ["duplicate_of_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_scanned_dup_of", "scanned_documents", type_="foreignkey")
    op.drop_column("scanned_documents", "duplicate_of_id")
    op.drop_column("scanned_documents", "lifecycle_status")

    op.drop_constraint("fk_tx_revenue_stream", "transactions", type_="foreignkey")
    op.drop_constraint("fk_tx_cost_center", "transactions", type_="foreignkey")
    op.drop_column("transactions", "ai_analysis_json")
    op.drop_column("transactions", "revenue_stream_id")
    op.drop_column("transactions", "cost_center_id")

    op.drop_table("ai_memory_entries")
    op.drop_table("workflow_actions")
    op.drop_table("reconciliation_matches")
    op.drop_table("financial_obligations")
    op.drop_table("revenue_streams")
    op.drop_table("cost_centers")
    op.drop_table("business_entities")
