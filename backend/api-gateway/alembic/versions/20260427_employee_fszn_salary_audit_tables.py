"""Employees/FSZN/salary/audit schema additions (non-destructive).

Adds required HR and compliance tables and extends existing employees table
without modifying prior migrations.
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "emp_fszn_salary_audit_tables"
down_revision: str | None = "org_llm_isolated_key"
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
    conn = op.get_bind()
    insp = inspect(conn)

    # employees table already exists in current product; only add missing fields.
    if _has_table(insp, "employees"):
        if not _has_column(insp, "employees", "tenant_id"):
            op.add_column("employees", sa.Column("tenant_id", sa.String(36), nullable=True))
        if not _has_column(insp, "employees", "passport_data"):
            op.add_column("employees", sa.Column("passport_data", sa.Text(), nullable=True))
        if not _has_column(insp, "employees", "phone"):
            op.add_column("employees", sa.Column("phone", sa.Text(), nullable=True))
        if not _has_column(insp, "employees", "email"):
            op.add_column("employees", sa.Column("email", sa.Text(), nullable=True))
        if not _has_column(insp, "employees", "address"):
            op.add_column("employees", sa.Column("address", sa.Text(), nullable=True))
        if not _has_column(insp, "employees", "hire_date"):
            op.add_column("employees", sa.Column("hire_date", sa.Date(), nullable=True))
        if not _has_column(insp, "employees", "salary"):
            op.add_column("employees", sa.Column("salary", sa.Numeric(14, 2), nullable=True))
        if not _has_column(insp, "employees", "position_code"):
            op.add_column("employees", sa.Column("position_code", sa.String(80), nullable=True))
        if not _has_column(insp, "employees", "position_name"):
            op.add_column("employees", sa.Column("position_name", sa.String(255), nullable=True))
        if not _has_column(insp, "employees", "terminated_at"):
            op.add_column("employees", sa.Column("terminated_at", sa.DateTime(), nullable=True))

    insp = inspect(conn)

    if not _has_table(insp, "employee_documents"):
        op.create_table(
            "employee_documents",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("employee_id", sa.String(36), nullable=False),
            sa.Column("doc_type", sa.String(100), nullable=False),
            sa.Column("file_url", sa.Text(), nullable=False),
            sa.Column("signed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if not _has_table(insp, "fszn_reports"):
        op.create_table(
            "fszn_reports",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("tenant_id", sa.String(36), nullable=False),
            sa.Column("report_type", sa.String(50), nullable=False),
            sa.Column("period", sa.Date(), nullable=False),
            sa.Column("xml_data", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
            sa.Column("protocol_id", sa.String(120), nullable=True),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if not _has_table(insp, "salary_calculations"):
        op.create_table(
            "salary_calculations",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("employee_id", sa.String(36), nullable=False),
            sa.Column("period", sa.Date(), nullable=False),
            sa.Column("base_salary", sa.Numeric(14, 2), nullable=False),
            sa.Column("bonuses", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("taxes", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("net_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if not _has_table(insp, "audit_log"):
        op.create_table(
            "audit_log",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("action", sa.String(255), nullable=False),
            sa.Column("entity_type", sa.String(120), nullable=False),
            sa.Column("entity_id", sa.String(36), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            # Имя колонки не «metadata»: в SQLAlchemy/Alembic оно конфликтует с MetaData таблицы и ломает DDL на проде.
            sa.Column("payload", sa.JSON(), nullable=True),
        )

    insp = inspect(conn)

    # Required indexes: tenant_id / employee_id / created_at.
    if _has_table(insp, "employees") and _has_column(insp, "employees", "tenant_id"):
        if not _has_index(insp, "employees", "ix_employees_tenant_id"):
            op.create_index("ix_employees_tenant_id", "employees", ["tenant_id"])
    if _has_table(insp, "employees") and _has_column(insp, "employees", "created_at"):
        if not _has_index(insp, "employees", "ix_employees_created_at"):
            op.create_index("ix_employees_created_at", "employees", ["created_at"])

    if _has_table(insp, "employee_documents") and _has_column(insp, "employee_documents", "employee_id"):
        if not _has_index(insp, "employee_documents", "ix_employee_documents_employee_id"):
            op.create_index("ix_employee_documents_employee_id", "employee_documents", ["employee_id"])
    if _has_table(insp, "employee_documents") and _has_column(insp, "employee_documents", "created_at"):
        if not _has_index(insp, "employee_documents", "ix_employee_documents_created_at"):
            op.create_index("ix_employee_documents_created_at", "employee_documents", ["created_at"])

    if _has_table(insp, "fszn_reports") and _has_column(insp, "fszn_reports", "tenant_id"):
        if not _has_index(insp, "fszn_reports", "ix_fszn_reports_tenant_id"):
            op.create_index("ix_fszn_reports_tenant_id", "fszn_reports", ["tenant_id"])
    if _has_table(insp, "fszn_reports") and _has_column(insp, "fszn_reports", "created_at"):
        if not _has_index(insp, "fszn_reports", "ix_fszn_reports_created_at"):
            op.create_index("ix_fszn_reports_created_at", "fszn_reports", ["created_at"])

    if _has_table(insp, "salary_calculations") and _has_column(insp, "salary_calculations", "employee_id"):
        if not _has_index(insp, "salary_calculations", "ix_salary_calculations_employee_id"):
            op.create_index("ix_salary_calculations_employee_id", "salary_calculations", ["employee_id"])
    if _has_table(insp, "salary_calculations") and _has_column(insp, "salary_calculations", "created_at"):
        if not _has_index(insp, "salary_calculations", "ix_salary_calculations_created_at"):
            op.create_index("ix_salary_calculations_created_at", "salary_calculations", ["created_at"])

    if _has_table(insp, "audit_log") and _has_column(insp, "audit_log", "created_at"):
        if not _has_index(insp, "audit_log", "ix_audit_log_created_at"):
            op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
    if _has_table(insp, "audit_log") and _has_column(insp, "audit_log", "user_id"):
        if not _has_index(insp, "audit_log", "ix_audit_log_user_id"):
            op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if _has_table(insp, "audit_log"):
        if _has_index(insp, "audit_log", "ix_audit_log_user_id"):
            op.drop_index("ix_audit_log_user_id", table_name="audit_log")
        if _has_index(insp, "audit_log", "ix_audit_log_created_at"):
            op.drop_index("ix_audit_log_created_at", table_name="audit_log")
        op.drop_table("audit_log")

    if _has_table(insp, "salary_calculations"):
        if _has_index(insp, "salary_calculations", "ix_salary_calculations_employee_id"):
            op.drop_index("ix_salary_calculations_employee_id", table_name="salary_calculations")
        if _has_index(insp, "salary_calculations", "ix_salary_calculations_created_at"):
            op.drop_index("ix_salary_calculations_created_at", table_name="salary_calculations")
        op.drop_table("salary_calculations")

    if _has_table(insp, "fszn_reports"):
        if _has_index(insp, "fszn_reports", "ix_fszn_reports_tenant_id"):
            op.drop_index("ix_fszn_reports_tenant_id", table_name="fszn_reports")
        if _has_index(insp, "fszn_reports", "ix_fszn_reports_created_at"):
            op.drop_index("ix_fszn_reports_created_at", table_name="fszn_reports")
        op.drop_table("fszn_reports")

    if _has_table(insp, "employee_documents"):
        if _has_index(insp, "employee_documents", "ix_employee_documents_employee_id"):
            op.drop_index("ix_employee_documents_employee_id", table_name="employee_documents")
        if _has_index(insp, "employee_documents", "ix_employee_documents_created_at"):
            op.drop_index("ix_employee_documents_created_at", table_name="employee_documents")
        op.drop_table("employee_documents")
