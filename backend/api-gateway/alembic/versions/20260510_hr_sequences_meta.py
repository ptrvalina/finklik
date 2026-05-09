"""HR order sequences and employee hr_meta_json."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "hr_sequences_meta"
down_revision: str | None = "user_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, col: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return col in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_column(insp, "organizations", "hr_hire_order_seq"):
        op.add_column("organizations", sa.Column("hr_hire_order_seq", sa.Integer(), nullable=False, server_default="0"))
    if not _has_column(insp, "organizations", "hr_fire_order_seq"):
        op.add_column("organizations", sa.Column("hr_fire_order_seq", sa.Integer(), nullable=False, server_default="0"))
    if not _has_column(insp, "employees", "hr_meta_json"):
        op.add_column("employees", sa.Column("hr_meta_json", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if _has_column(insp, "employees", "hr_meta_json"):
        op.drop_column("employees", "hr_meta_json")
    if _has_column(insp, "organizations", "hr_fire_order_seq"):
        op.drop_column("organizations", "hr_fire_order_seq")
    if _has_column(insp, "organizations", "hr_hire_order_seq"):
        op.drop_column("organizations", "hr_hire_order_seq")
