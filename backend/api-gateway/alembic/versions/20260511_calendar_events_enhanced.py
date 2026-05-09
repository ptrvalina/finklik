"""Calendar events: time range, completion, reminder flags."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "calendar_events_enhanced"
down_revision: str | None = "hr_sequences_meta"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, col: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return col in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_column(insp, "calendar_events", "all_day"):
        op.add_column(
            "calendar_events",
            sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    if not _has_column(insp, "calendar_events", "time_start"):
        op.add_column("calendar_events", sa.Column("time_start", sa.String(5), nullable=True))
    if not _has_column(insp, "calendar_events", "time_end"):
        op.add_column("calendar_events", sa.Column("time_end", sa.String(5), nullable=True))
    if not _has_column(insp, "calendar_events", "is_completed"):
        op.add_column(
            "calendar_events",
            sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if not _has_column(insp, "calendar_events", "completed_at"):
        op.add_column("calendar_events", sa.Column("completed_at", sa.DateTime(), nullable=True))
    if not _has_column(insp, "calendar_events", "remind_email"):
        op.add_column(
            "calendar_events",
            sa.Column("remind_email", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if not _has_column(insp, "calendar_events", "remind_telegram"):
        op.add_column(
            "calendar_events",
            sa.Column("remind_telegram", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    for col in ("remind_telegram", "remind_email", "completed_at", "is_completed", "time_end", "time_start", "all_day"):
        if _has_column(insp, "calendar_events", col):
            op.drop_column("calendar_events", col)
