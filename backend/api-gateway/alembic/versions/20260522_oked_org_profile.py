"""OKED reference table and organization business profile fields."""

from alembic import op
import sqlalchemy as sa

revision: str = "oked_org_profile_v1"
down_revision: str | None = "signing_requests_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "oked_reference",
        sa.Column("code", sa.String(12), primary_key=True),
        sa.Column("name_ru", sa.String(512), nullable=False),
        sa.Column("parent_code", sa.String(12), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("search_aliases", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_oked_parent", "oked_reference", ["parent_code"])
    op.create_index("ix_oked_level", "oked_reference", ["level"])

    op.add_column("organizations", sa.Column("oked_primary", sa.String(12), nullable=True))
    op.add_column("organizations", sa.Column("oked_secondary_json", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("employee_count_band", sa.String(16), nullable=True))
    op.add_column("organizations", sa.Column("business_profile_completed_at", sa.DateTime(), nullable=True))
    op.create_index("ix_organizations_oked_primary", "organizations", ["oked_primary"])


def downgrade() -> None:
    op.drop_index("ix_organizations_oked_primary", table_name="organizations")
    op.drop_column("organizations", "business_profile_completed_at")
    op.drop_column("organizations", "employee_count_band")
    op.drop_column("organizations", "oked_secondary_json")
    op.drop_column("organizations", "oked_primary")
    op.drop_table("oked_reference")
