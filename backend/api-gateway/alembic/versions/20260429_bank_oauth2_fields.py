"""Add OAuth2 integration fields for bank accounts."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "bank_oauth2_fields"
down_revision: str | None = "transactions_kudir_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_column(insp, table: str, column: str) -> bool:
    if not _has_table(insp, table):
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_table(insp, "bank_accounts"):
        return

    if not _has_column(insp, "bank_accounts", "oauth_provider"):
        op.add_column("bank_accounts", sa.Column("oauth_provider", sa.String(100), nullable=True))
    if not _has_column(insp, "bank_accounts", "oauth_access_token"):
        op.add_column("bank_accounts", sa.Column("oauth_access_token", sa.Text(), nullable=True))
    if not _has_column(insp, "bank_accounts", "oauth_refresh_token"):
        op.add_column("bank_accounts", sa.Column("oauth_refresh_token", sa.Text(), nullable=True))
    if not _has_column(insp, "bank_accounts", "oauth_token_expires_at"):
        op.add_column("bank_accounts", sa.Column("oauth_token_expires_at", sa.DateTime(), nullable=True))
    if not _has_column(insp, "bank_accounts", "oauth_connected_at"):
        op.add_column("bank_accounts", sa.Column("oauth_connected_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_table(insp, "bank_accounts"):
        return

    if _has_column(insp, "bank_accounts", "oauth_connected_at"):
        op.drop_column("bank_accounts", "oauth_connected_at")
    if _has_column(insp, "bank_accounts", "oauth_token_expires_at"):
        op.drop_column("bank_accounts", "oauth_token_expires_at")
    if _has_column(insp, "bank_accounts", "oauth_refresh_token"):
        op.drop_column("bank_accounts", "oauth_refresh_token")
    if _has_column(insp, "bank_accounts", "oauth_access_token"):
        op.drop_column("bank_accounts", "oauth_access_token")
    if _has_column(insp, "bank_accounts", "oauth_provider"):
        op.drop_column("bank_accounts", "oauth_provider")
