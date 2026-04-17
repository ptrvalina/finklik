"""Regulatory updates and report submission tables for Postgres.

Models in app.models.regulatory existed without Alembic revisions; production
DBs that only run migrations would miss these tables and fail on /regulatory and
/submissions endpoints.
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "sprint12_regulatory_reporting"
down_revision: str | None = "sprint10_scanned_documents"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "organizations" not in names:
        return

    if "regulatory_updates" not in names:
        op.create_table(
            "regulatory_updates",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("authority", sa.String(30), nullable=False),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("category", sa.String(50), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
            sa.Column("effective_date", sa.DateTime(), nullable=True),
            sa.Column("source_url", sa.String(500), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if "regulatory_notifications" not in names:
        op.create_table(
            "regulatory_notifications",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("update_id", sa.String(36), sa.ForeignKey("regulatory_updates.id"), nullable=False),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("read_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index(
            "ix_regulatory_notifications_org",
            "regulatory_notifications",
            ["organization_id"],
        )

    if "report_submissions" not in names:
        op.create_table(
            "report_submissions",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("authority", sa.String(30), nullable=False),
            sa.Column("report_type", sa.String(50), nullable=False),
            sa.Column("report_period", sa.String(20), nullable=False),
            sa.Column("report_data_json", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
            sa.Column("confirmed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("confirmed_at", sa.DateTime(), nullable=True),
            sa.Column("submitted_at", sa.DateTime(), nullable=True),
            sa.Column("submission_ref", sa.String(100), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index(
            "ix_report_submissions_org_created",
            "report_submissions",
            ["organization_id", "created_at"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "report_submissions" in names:
        op.drop_index("ix_report_submissions_org_created", table_name="report_submissions")
        op.drop_table("report_submissions")
    if "regulatory_notifications" in names:
        op.drop_index("ix_regulatory_notifications_org", table_name="regulatory_notifications")
        op.drop_table("regulatory_notifications")
    if "regulatory_updates" in names:
        op.drop_table("regulatory_updates")
