"""Organization legal_address / ceo_name; counterparty cp_kind / is_pinned."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "org_legal_cp_kind"
down_revision: str | None = "telegram_chat_calendar_reminders"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, col: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return col in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if not _has_column(insp, "organizations", "legal_address"):
        op.add_column("organizations", sa.Column("legal_address", sa.Text(), nullable=True))
    if not _has_column(insp, "organizations", "ceo_name"):
        op.add_column("organizations", sa.Column("ceo_name", sa.String(length=255), nullable=True))

    if not _has_column(insp, "counterparties", "cp_kind"):
        op.add_column(
            "counterparties",
            sa.Column("cp_kind", sa.String(length=20), nullable=False, server_default="both"),
        )
    if not _has_column(insp, "counterparties", "is_pinned"):
        op.add_column(
            "counterparties",
            sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if _has_column(insp, "counterparties", "is_pinned"):
        op.drop_column("counterparties", "is_pinned")
    if _has_column(insp, "counterparties", "cp_kind"):
        op.drop_column("counterparties", "cp_kind")
    if _has_column(insp, "organizations", "ceo_name"):
        op.drop_column("organizations", "ceo_name")
    if _has_column(insp, "organizations", "legal_address"):
        op.drop_column("organizations", "legal_address")
