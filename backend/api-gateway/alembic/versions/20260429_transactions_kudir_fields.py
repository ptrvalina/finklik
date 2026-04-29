"""Add KUDiR source and AI fields to transactions."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "transactions_kudir_fields"
down_revision: str | None = "planner_notifications_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_column(insp, table: str, column: str) -> bool:
    if not _has_table(insp, table):
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_table(insp, "transactions"):
        return

    if not _has_column(insp, "transactions", "source"):
        op.add_column("transactions", sa.Column("source", sa.String(20), nullable=False, server_default="manual"))
    if not _has_column(insp, "transactions", "ai_category_confidence"):
        op.add_column("transactions", sa.Column("ai_category_confidence", sa.Numeric(5, 4), nullable=True))
    if not _has_column(insp, "transactions", "receipt_image_url"):
        op.add_column("transactions", sa.Column("receipt_image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_table(insp, "transactions"):
        return
    if _has_column(insp, "transactions", "receipt_image_url"):
        op.drop_column("transactions", "receipt_image_url")
    if _has_column(insp, "transactions", "ai_category_confidence"):
        op.drop_column("transactions", "ai_category_confidence")
    if _has_column(insp, "transactions", "source"):
        op.drop_column("transactions", "source")
