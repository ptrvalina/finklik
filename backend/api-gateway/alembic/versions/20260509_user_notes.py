"""Personal user notes per organization."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "user_notes"
down_revision: str | None = "planner_comments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_index(insp, table: str, index_name: str) -> bool:
    if not _has_table(insp, table):
        return False
    return index_name in {i["name"] for i in insp.get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_table(insp, "user_notes"):
        op.create_table(
            "user_notes",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("title", sa.String(500), nullable=False, server_default=""),
            sa.Column("body", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    insp = inspect(conn)
    if _has_table(insp, "user_notes") and not _has_index(insp, "user_notes", "ix_user_notes_organization_id"):
        op.create_index("ix_user_notes_organization_id", "user_notes", ["organization_id"])
    if _has_table(insp, "user_notes") and not _has_index(insp, "user_notes", "ix_user_notes_user_id"):
        op.create_index("ix_user_notes_user_id", "user_notes", ["user_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if _has_table(insp, "user_notes"):
        if _has_index(insp, "user_notes", "ix_user_notes_user_id"):
            op.drop_index("ix_user_notes_user_id", table_name="user_notes")
        if _has_index(insp, "user_notes", "ix_user_notes_organization_id"):
            op.drop_index("ix_user_notes_organization_id", table_name="user_notes")
        op.drop_table("user_notes")
