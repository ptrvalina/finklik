"""Flow 3: multi-org memberships, operational inbox, approvals, collaboration comments."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "flow3_collaboration_workspace_v1"
down_revision: str | None = "domain_events_hybrid_v1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_organization_memberships",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_in_org", sa.String(20), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_user_org_membership"),
    )
    op.create_index("ix_membership_user", "user_organization_memberships", ["user_id"])
    op.create_index("ix_membership_org", "user_organization_memberships", ["organization_id"])

    op.create_table(
        "operational_inbox_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("linked_transaction_id", sa.String(36), nullable=True),
        sa.Column("linked_document_id", sa.String(36), nullable=True),
        sa.Column("assignee_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_inbox_org_status", "operational_inbox_items", ["organization_id", "status"])
    op.create_index("ix_inbox_org_created", "operational_inbox_items", ["organization_id", "created_at"])

    op.create_table(
        "approval_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_kind", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("requested_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resolved_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_approval_org_status", "approval_requests", ["organization_id", "status"])
    op.create_index("ix_approval_subject", "approval_requests", ["organization_id", "subject_kind", "subject_id"])

    op.create_table(
        "collaboration_comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_kind", sa.String(40), nullable=False),
        sa.Column("target_id", sa.String(64), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_collab_comment_target", "collaboration_comments", ["organization_id", "target_kind", "target_id"])

    conn = op.get_bind()
    import uuid

    from sqlalchemy import text

    rows = conn.execute(text("SELECT id, organization_id, role FROM users WHERE organization_id IS NOT NULL")).fetchall()
    for uid, oid, role in rows:
        conn.execute(
            text(
                "INSERT INTO user_organization_memberships "
                "(id, user_id, organization_id, role_in_org, is_pinned, last_used_at, created_at) "
                "VALUES (:id, :uid, :oid, :role, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {"id": str(uuid.uuid4()), "uid": uid, "oid": oid, "role": role},
        )


def downgrade() -> None:
    op.drop_index("ix_collab_comment_target", table_name="collaboration_comments")
    op.drop_table("collaboration_comments")
    op.drop_index("ix_approval_subject", table_name="approval_requests")
    op.drop_index("ix_approval_org_status", table_name="approval_requests")
    op.drop_table("approval_requests")
    op.drop_index("ix_inbox_org_created", table_name="operational_inbox_items")
    op.drop_index("ix_inbox_org_status", table_name="operational_inbox_items")
    op.drop_table("operational_inbox_items")
    op.drop_index("ix_membership_org", table_name="user_organization_memberships")
    op.drop_index("ix_membership_user", table_name="user_organization_memberships")
    op.drop_table("user_organization_memberships")
