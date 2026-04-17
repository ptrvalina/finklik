"""Sprint: scanned_documents table for scanner OCR persistence.

Model existed in SQLAlchemy but had no Alembic migration — Postgres (e.g. Render)
failed on POST /scanner/upload with undefined relation.
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "sprint10_scanned_documents"
down_revision: str | None = "add_org_columns"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "scanned_documents" in names:
        return

    op.create_table(
        "scanned_documents",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("doc_type", sa.String(30), nullable=False, server_default="unknown"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("ocr_text", sa.Text(), nullable=True),
        sa.Column("parsed_data", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transaction_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_scanned_documents_org_created", "scanned_documents", ["organization_id", "created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "scanned_documents" not in insp.get_table_names():
        return
    op.drop_index("ix_scanned_documents_org_created", table_name="scanned_documents")
    op.drop_table("scanned_documents")
