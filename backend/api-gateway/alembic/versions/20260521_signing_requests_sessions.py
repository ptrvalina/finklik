"""ЭЦП Model A: signing_requests + signing_sessions (хэш на сервере, подпись с клиента)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "signing_requests_v1"
down_revision: str | None = "user_refresh_jti_v1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "signing_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("document_kind", sa.String(40), nullable=False),
        sa.Column("document_id", sa.String(64), nullable=False),
        sa.Column("document_hash", sa.String(64), nullable=False),
        sa.Column("hash_algorithm", sa.String(20), nullable=False, server_default="SHA-256"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("signature_b64", sa.Text(), nullable=True),
        sa.Column("certificate_pem", sa.Text(), nullable=True),
        sa.Column("certificate_metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("signed_at", sa.DateTime(), nullable=True),
        sa.Column("rejection_reason", sa.String(512), nullable=True),
    )
    op.create_index("ix_signing_requests_org_status", "signing_requests", ["organization_id", "status"])
    op.create_index("ix_signing_requests_doc", "signing_requests", ["organization_id", "document_kind", "document_id"])

    op.create_table(
        "signing_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_id", sa.String(36), sa.ForeignKey("signing_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_metadata_json", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_signing_sessions_request", "signing_sessions", ["request_id"])


def downgrade() -> None:
    op.drop_index("ix_signing_sessions_request", table_name="signing_sessions")
    op.drop_table("signing_sessions")
    op.drop_index("ix_signing_requests_doc", table_name="signing_requests")
    op.drop_index("ix_signing_requests_org_status", table_name="signing_requests")
    op.drop_table("signing_requests")
