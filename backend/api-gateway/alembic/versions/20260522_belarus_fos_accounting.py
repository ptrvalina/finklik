"""Belarus FOS: chart of accounts, ledger, fixed assets, org accounting mode, OCR confidence."""

from alembic import op
import sqlalchemy as sa

revision = "belarus_fos_accounting_v1"
down_revision = "oked_org_profile_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chart_accounts",
        sa.Column("code", sa.String(8), primary_key=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("account_class", sa.Integer(), nullable=False),
        sa.Column("balance_type", sa.String(20), nullable=False),
        sa.Column("is_off_balance", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "chart_subaccounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("parent_account_code", sa.String(8), sa.ForeignKey("chart_accounts.code"), nullable=False),
        sa.Column("parent_id", sa.String(36), sa.ForeignKey("chart_subaccounts.id"), nullable=True),
        sa.Column("full_code", sa.String(32), nullable=False),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("organization_id", "full_code", name="uq_chart_subaccount_org_code"),
    )
    op.create_index("ix_chart_subaccount_org_parent", "chart_subaccounts", ["organization_id", "parent_id"])

    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("debit_account", sa.String(32), nullable=False),
        sa.Column("credit_account", sa.String(32), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="BYN"),
        sa.Column("description", sa.String(512), nullable=True),
        sa.Column("analytics_json", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(40), nullable=True),
        sa.Column("source_id", sa.String(36), nullable=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_ledger_org_date", "ledger_entries", ["organization_id", "entry_date"])
    op.create_index("ix_ledger_org_source", "ledger_entries", ["organization_id", "source_type", "source_id"])

    op.create_table(
        "fixed_assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("inventory_number", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("purchase_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("useful_life_months", sa.Integer(), nullable=False),
        sa.Column("depreciation_method", sa.String(20), nullable=False, server_default="straight_line"),
        sa.Column("salvage_value", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("asset_account", sa.String(8), nullable=False, server_default="01"),
        sa.Column("depreciation_account", sa.String(8), nullable=False, server_default="02"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_fixed_assets_org", "fixed_assets", ["organization_id"])

    op.create_table(
        "amortization_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("fixed_asset_id", sa.String(36), sa.ForeignKey("fixed_assets.id"), nullable=False),
        sa.Column("period_year", sa.Integer(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("ledger_entry_id", sa.String(36), sa.ForeignKey("ledger_entries.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_amort_org_period", "amortization_entries", ["organization_id", "period_year", "period_month"])

    op.add_column(
        "organizations",
        sa.Column("accounting_mode", sa.String(16), nullable=False, server_default="simple"),
    )
    op.add_column("scanned_documents", sa.Column("requires_review", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("scanned_documents", sa.Column("field_confidence_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("scanned_documents", "field_confidence_json")
    op.drop_column("scanned_documents", "requires_review")
    op.drop_column("organizations", "accounting_mode")
    op.drop_table("amortization_entries")
    op.drop_table("fixed_assets")
    op.drop_table("ledger_entries")
    op.drop_table("chart_subaccounts")
    op.drop_table("chart_accounts")
