"""User telegram_chat_id, calendar created_by_user_id, reminder delivery queue."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "telegram_chat_calendar_reminders"
down_revision: str | None = "calendar_events_enhanced"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, col: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return col in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if not _has_column(insp, "users", "telegram_chat_id"):
        op.add_column("users", sa.Column("telegram_chat_id", sa.String(length=64), nullable=True))

    if not _has_column(insp, "calendar_events", "created_by_user_id"):
        op.add_column(
            "calendar_events",
            sa.Column(
                "created_by_user_id",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_calendar_events_created_by_user_id", "calendar_events", ["created_by_user_id"])

    if "calendar_reminder_deliveries" not in insp.get_table_names():
        op.create_table(
            "calendar_reminder_deliveries",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column(
                "event_id",
                sa.String(length=36),
                sa.ForeignKey("calendar_events.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("channel", sa.String(length=16), nullable=False),
            sa.Column("fire_at", sa.DateTime(), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_calendar_reminder_deliveries_event_id", "calendar_reminder_deliveries", ["event_id"])
        op.create_index("ix_calendar_reminder_deliveries_user_id", "calendar_reminder_deliveries", ["user_id"])
        op.create_index("ix_calendar_reminder_deliveries_fire_at", "calendar_reminder_deliveries", ["fire_at"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "calendar_reminder_deliveries" in insp.get_table_names():
        op.drop_index("ix_calendar_reminder_deliveries_fire_at", table_name="calendar_reminder_deliveries")
        op.drop_index("ix_calendar_reminder_deliveries_user_id", table_name="calendar_reminder_deliveries")
        op.drop_index("ix_calendar_reminder_deliveries_event_id", table_name="calendar_reminder_deliveries")
        op.drop_table("calendar_reminder_deliveries")

    if _has_column(insp, "calendar_events", "created_by_user_id"):
        op.drop_index("ix_calendar_events_created_by_user_id", table_name="calendar_events")
        op.drop_column("calendar_events", "created_by_user_id")

    if _has_column(insp, "users", "telegram_chat_id"):
        op.drop_column("users", "telegram_chat_id")
