"""Ensure audit_log.metadata JSONB column exists and is populated."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "audit_log_metadata_jsonb"
down_revision: str | None = "emp_fszn_salary_audit_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_column(insp, table: str, column: str) -> bool:
    if not _has_table(insp, table):
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def _has_index(insp, table: str, index_name: str) -> bool:
    if not _has_table(insp, table):
        return False
    return index_name in {i["name"] for i in insp.get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not _has_table(insp, "audit_log"):
        return

    if not _has_column(insp, "audit_log", "metadata"):
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.add_column("audit_log", sa.Column("metadata", json_type, nullable=True))

    insp = inspect(bind)
    if _has_column(insp, "audit_log", "payload"):
        if bind.dialect.name == "postgresql":
            op.execute(
                sa.text(
                    """
                    UPDATE audit_log
                    SET metadata = COALESCE(metadata, payload::jsonb)
                    WHERE payload IS NOT NULL
                    """
                )
            )
        else:
            op.execute(
                sa.text(
                    """
                    UPDATE audit_log
                    SET metadata = COALESCE(metadata, payload)
                    WHERE payload IS NOT NULL
                    """
                )
            )

    if _has_column(insp, "audit_log", "entity_id") and not _has_index(insp, "audit_log", "ix_audit_log_entity_id"):
        op.create_index("ix_audit_log_entity_id", "audit_log", ["entity_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not _has_table(insp, "audit_log"):
        return

    if _has_index(insp, "audit_log", "ix_audit_log_entity_id"):
        op.drop_index("ix_audit_log_entity_id", table_name="audit_log")

    if _has_column(insp, "audit_log", "metadata"):
        op.drop_column("audit_log", "metadata")
