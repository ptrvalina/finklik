"""Add missing columns to organizations table for Postgres deployments.

The Organization model has legal_form, tax_regime, max_users columns that
were created via create_all on SQLite but never had an explicit Alembic migration
for Postgres (Render). This migration adds them idempotently.
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_org_columns"
down_revision: str | None = "sprint9_payment_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, column: str) -> bool:
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        return

    if not _has_column(insp, "organizations", "legal_form"):
        op.add_column("organizations", sa.Column("legal_form", sa.String(10), server_default="ip"))

    if not _has_column(insp, "organizations", "tax_regime"):
        op.add_column("organizations", sa.Column("tax_regime", sa.String(20), server_default="usn_no_vat"))

    if not _has_column(insp, "organizations", "max_users"):
        op.add_column("organizations", sa.Column("max_users", sa.Integer(), server_default="2"))


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        return
    if _has_column(insp, "organizations", "legal_form"):
        op.drop_column("organizations", "legal_form")
    if _has_column(insp, "organizations", "tax_regime"):
        op.drop_column("organizations", "tax_regime")
    if _has_column(insp, "organizations", "max_users"):
        op.drop_column("organizations", "max_users")
