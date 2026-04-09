"""Automated report submission with client confirmation.

Workflow:
  1. System generates report (draft)
  2. Client reviews and confirms (confirmed)
  3. System submits to authority (submitted → accepted/rejected)

Until real portal APIs are available, submission is mocked with realistic delays.
"""
import json
import uuid
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, Organization
from app.models.regulatory import ReportSubmission

router = APIRouter(prefix="/submissions", tags=["report-submissions"])

REPORT_TYPES = {
    "fsszn": {
        "pu-3": "ПУ-3 (персонифицированный учёт)",
        "4-fund": "4-фонд (отчёт о средствах ФСЗН)",
    },
    "imns": {
        "usn-declaration": "Декларация по УСН",
        "vat-declaration": "Декларация по НДС",
        "income-tax": "Налог на прибыль",
    },
    "belgosstrakh": {
        "insurance-report": "Отчёт по обязательному страхованию",
    },
    "belstat": {
        "12-t": "Форма 12-т (отчёт по труду)",
        "1-enterprise": "Форма 1-предприятие",
    },
}


class CreateSubmissionRequest(BaseModel):
    authority: str = Field(..., pattern="^(fsszn|imns|belgosstrakh|belstat)$")
    report_type: str
    report_period: str = Field(..., pattern=r"^\d{4}-(Q[1-4]|M(0[1-9]|1[0-2]))$")


class ConfirmSubmissionRequest(BaseModel):
    confirmation_code: str | None = None


@router.get("/report-types")
async def list_report_types():
    """List available report types by authority."""
    return {"report_types": REPORT_TYPES}


@router.get("")
async def list_submissions(
    authority: str | None = Query(None),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all report submissions for the organization."""
    query = select(ReportSubmission).where(
        ReportSubmission.organization_id == current_user.organization_id
    )
    if authority:
        query = query.where(ReportSubmission.authority == authority)
    if status:
        query = query.where(ReportSubmission.status == status)
    query = query.order_by(desc(ReportSubmission.created_at))

    result = await db.execute(query)
    submissions = result.scalars().all()

    return {
        "submissions": [
            _serialize(s) for s in submissions
        ]
    }


@router.post("")
async def create_submission(
    body: CreateSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new report submission (draft)."""
    authority_types = REPORT_TYPES.get(body.authority, {})
    if body.report_type not in authority_types:
        raise HTTPException(400, f"Неизвестный тип отчёта: {body.report_type}")

    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_result.scalar_one_or_none()

    report_data = _generate_mock_report_data(body.authority, body.report_type, body.report_period, org)

    submission = ReportSubmission(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        authority=body.authority,
        report_type=body.report_type,
        report_period=body.report_period,
        report_data_json=json.dumps(report_data, ensure_ascii=False, default=str),
        status="pending_review",
    )
    db.add(submission)
    await db.flush()

    return _serialize(submission)


@router.post("/{submission_id}/confirm")
async def confirm_submission(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client confirms the report — authorizes submission."""
    result = await db.execute(
        select(ReportSubmission).where(
            ReportSubmission.id == submission_id,
            ReportSubmission.organization_id == current_user.organization_id,
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(404, "Отчёт не найден")

    if submission.status != "pending_review":
        raise HTTPException(400, f"Невозможно подтвердить отчёт в статусе '{submission.status}'")

    submission.status = "confirmed"
    submission.confirmed_by = current_user.id
    submission.confirmed_at = datetime.now(timezone.utc)
    await db.flush()

    return _serialize(submission)


@router.post("/{submission_id}/submit")
async def submit_report(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit confirmed report to the authority (mock)."""
    result = await db.execute(
        select(ReportSubmission).where(
            ReportSubmission.id == submission_id,
            ReportSubmission.organization_id == current_user.organization_id,
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(404, "Отчёт не найден")

    if submission.status != "confirmed":
        raise HTTPException(400, "Отчёт должен быть подтверждён перед отправкой")

    submission.status = "submitted"
    submission.submitted_at = datetime.now(timezone.utc)
    submission.submission_ref = f"REF-{secrets.token_hex(6).upper()}"
    await db.flush()

    submission.status = "accepted"
    await db.flush()

    return {
        **_serialize(submission),
        "message": f"Отчёт успешно подан в {_authority_name(submission.authority)}. "
                   f"Референс: {submission.submission_ref}",
    }


@router.post("/{submission_id}/reject")
async def reject_submission(
    submission_id: str,
    reason: str = Query("Данные требуют корректировки"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a submission (return to draft)."""
    result = await db.execute(
        select(ReportSubmission).where(
            ReportSubmission.id == submission_id,
            ReportSubmission.organization_id == current_user.organization_id,
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(404, "Отчёт не найден")

    if submission.status not in ("pending_review", "confirmed"):
        raise HTTPException(400, "Невозможно отклонить отчёт в текущем статусе")

    submission.status = "draft"
    submission.rejection_reason = reason
    submission.confirmed_by = None
    submission.confirmed_at = None
    await db.flush()

    return _serialize(submission)


def _serialize(s: ReportSubmission) -> dict:
    authority_types = REPORT_TYPES.get(s.authority, {})
    return {
        "id": s.id,
        "authority": s.authority,
        "authority_name": _authority_name(s.authority),
        "report_type": s.report_type,
        "report_type_name": authority_types.get(s.report_type, s.report_type),
        "report_period": s.report_period,
        "status": s.status,
        "status_label": _status_label(s.status),
        "report_data": json.loads(s.report_data_json) if s.report_data_json else None,
        "confirmed_at": s.confirmed_at.isoformat() if s.confirmed_at else None,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        "submission_ref": s.submission_ref,
        "rejection_reason": s.rejection_reason,
        "created_at": s.created_at.isoformat(),
    }


def _authority_name(code: str) -> str:
    return {"fsszn": "ФСЗН", "imns": "ИМНС", "belgosstrakh": "Белгосстрах", "belstat": "Белстат"}.get(code, code)


def _status_label(status: str) -> str:
    return {
        "draft": "Черновик",
        "pending_review": "На проверке",
        "confirmed": "Подтверждён",
        "submitted": "Отправлен",
        "accepted": "Принят",
        "rejected": "Отклонён",
    }.get(status, status)


def _generate_mock_report_data(authority: str, report_type: str, period: str, org) -> dict:
    """Generate realistic mock data for report preview."""
    org_name = org.name if org else "ООО Тест"
    org_unp = org.unp if org else "123456789"

    base = {
        "organization": org_name,
        "unp": org_unp,
        "period": period,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    if authority == "fsszn" and report_type == "pu-3":
        return {
            **base,
            "form": "ПУ-3",
            "employees_count": 5,
            "total_fot": "15 240.00 BYN",
            "fsszn_34_percent": "5 181.60 BYN",
            "fsszn_1_percent": "152.40 BYN",
            "rows": [
                {"fio": "Иванов И.И.", "salary": "3 200.00", "fsszn": "1 088.00"},
                {"fio": "Петрова А.С.", "salary": "2 800.00", "fsszn": "952.00"},
                {"fio": "Сидоров К.В.", "salary": "3 500.00", "fsszn": "1 190.00"},
            ],
        }
    elif authority == "imns" and report_type == "usn-declaration":
        return {
            **base,
            "form": "Декларация по УСН",
            "tax_regime": "УСН 3%",
            "revenue": "48 500.00 BYN",
            "tax_base": "48 500.00 BYN",
            "tax_rate": "3%",
            "tax_amount": "1 455.00 BYN",
            "prepaid": "0.00 BYN",
            "to_pay": "1 455.00 BYN",
        }
    elif authority == "imns" and report_type == "vat-declaration":
        return {
            **base,
            "form": "Декларация по НДС",
            "sales_vat": "9 700.00 BYN",
            "purchase_vat": "6 200.00 BYN",
            "vat_to_pay": "3 500.00 BYN",
        }
    elif authority == "belgosstrakh" and report_type == "insurance-report":
        return {
            **base,
            "form": "Отчёт по обязательному страхованию",
            "employees_count": 5,
            "total_fot": "15 240.00 BYN",
            "insurance_rate": "0.6%",
            "insurance_amount": "91.44 BYN",
        }
    elif authority == "belstat":
        return {
            **base,
            "form": "Форма 12-т (краткая)",
            "avg_headcount": 5,
            "total_fot": "15 240.00 BYN",
            "avg_salary": "3 048.00 BYN",
        }

    return base
