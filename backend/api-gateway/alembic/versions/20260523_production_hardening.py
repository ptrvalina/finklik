"""Production hardening: periods, vendor memory, ledger metadata."""

from alembic import op
import sqlalchemy as sa

revision: str = "production_hardening_v1"
down_revision = "belarus_fos_accounting_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounting_periods",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.Column("closed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.UniqueConstraint("organization_id", "year", "month", name="uq_accounting_period_org_ym"),
    )
    op.create_index("ix_accounting_period_org", "accounting_periods", ["organization_id"])

    op.create_table(
        "vendor_memory",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("normalized_name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("unp", sa.String(16), nullable=True),
        sa.Column("default_category", sa.String(64), nullable=True),
        sa.Column("default_debit_account", sa.String(32), nullable=True),
        sa.Column("default_credit_account", sa.String(32), nullable=True),
        sa.Column("scan_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("organization_id", "normalized_name", name="uq_vendor_memory_org_name"),
    )
    op.create_index("ix_vendor_memory_org", "vendor_memory", ["organization_id"])

    op.add_column("ledger_entries", sa.Column("vat_amount", sa.Numeric(18, 2), nullable=True))
    op.add_column("ledger_entries", sa.Column("is_reversal", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("ledger_entries", sa.Column("reversal_of_id", sa.String(36), nullable=True))
    op.add_column("ledger_entries", sa.Column("period_year", sa.Integer(), nullable=True))
    op.add_column("ledger_entries", sa.Column("period_month", sa.Integer(), nullable=True))

    op.add_column("chart_accounts", sa.Column("normal_balance", sa.String(10), nullable=True))
    op.add_column("chart_accounts", sa.Column("is_optional", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("chart_accounts", sa.Column("requires_analytics", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("chart_subaccounts", sa.Column("is_official_template", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("chart_subaccounts", "is_official_template")
    op.drop_column("chart_accounts", "requires_analytics")
    op.drop_column("chart_accounts", "is_optional")
    op.drop_column("chart_accounts", "normal_balance")
    op.drop_column("ledger_entries", "period_month")
    op.drop_column("ledger_entries", "period_year")
    op.drop_column("ledger_entries", "reversal_of_id")
    op.drop_column("ledger_entries", "is_reversal")
    op.drop_column("ledger_entries", "vat_amount")
    op.drop_table("vendor_memory")
    op.drop_table("accounting_periods")
