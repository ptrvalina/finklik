"""Organization-isolated LLM API key (encrypted BYOK)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "org_llm_isolated_key"
down_revision: str | None = "employee_personnel_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, column: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        return

    if not _has_column(insp, "organizations", "llm_api_key_encrypted"):
        op.add_column("organizations", sa.Column("llm_api_key_encrypted", sa.Text(), nullable=True))
    if not _has_column(insp, "organizations", "llm_base_url"):
        op.add_column("organizations", sa.Column("llm_base_url", sa.String(512), nullable=True))
    if not _has_column(insp, "organizations", "llm_model"):
        op.add_column("organizations", sa.Column("llm_model", sa.String(128), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        return
    if _has_column(insp, "organizations", "llm_model"):
        op.drop_column("organizations", "llm_model")
    if _has_column(insp, "organizations", "llm_base_url"):
        op.drop_column("organizations", "llm_base_url")
    if _has_column(insp, "organizations", "llm_api_key_encrypted"):
        op.drop_column("organizations", "llm_api_key_encrypted")
