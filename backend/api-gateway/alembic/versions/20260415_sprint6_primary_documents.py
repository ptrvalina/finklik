"""Sprint 6: primary_document_sequences, primary_documents.related_document_id."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "sprint6_primary_docs"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    # Пустая БД: приложение поднимет схему через create_all — только ставим ревизию.
    if "organizations" not in names:
        return

    if "primary_document_sequences" not in names:
        op.create_table(
            "primary_document_sequences",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("doc_type", sa.String(20), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("last_number", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("organization_id", "doc_type", "year", name="uq_primary_doc_seq_org_type_year"),
        )
        op.create_index("ix_primary_document_sequences_organization_id", "primary_document_sequences", ["organization_id"])

    names = inspect(conn).get_table_names()
    if "primary_documents" in names:
        cols = {c["name"] for c in inspect(conn).get_columns("primary_documents")}
        if "related_document_id" not in cols:
            op.add_column("primary_documents", sa.Column("related_document_id", sa.String(36), nullable=True))
            op.create_index("ix_primary_documents_related_document_id", "primary_documents", ["related_document_id"])
            op.create_foreign_key(
                "fk_primary_documents_related_document_id",
                "primary_documents",
                "primary_documents",
                ["related_document_id"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "primary_documents" in names:
        cols = {c["name"] for c in insp.get_columns("primary_documents")}
        if "related_document_id" in cols:
            op.drop_constraint("fk_primary_documents_related_document_id", "primary_documents", type_="foreignkey")
            op.drop_index("ix_primary_documents_related_document_id", table_name="primary_documents")
            op.drop_column("primary_documents", "related_document_id")
    if "primary_document_sequences" in names:
        op.drop_table("primary_document_sequences")
