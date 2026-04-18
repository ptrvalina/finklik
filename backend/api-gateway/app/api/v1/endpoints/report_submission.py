"""Automated report submission with client confirmation.

Workflow:
  1. System generates report (draft)
  2. Client reviews and confirms (confirmed)
  3. System submits to authority (submitted → accepted/rejected)

Report payloads are filled from the ledger (transactions, salary) where possible;
portal submission remains mocked until real APIs exist.
"""
import calendar
import json
import re
import secrets
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.employee import Employee, SalaryRecord
from app.models.regulatory import ReportSubmission
from app.models.transaction import Transaction
from app.models.user import Organization, User
from app.security import get_encryptor
from app.services.tax_calculator import calculate_fsszn, calculate_usn, calculate_vat, get_tax_rules_for_year

router = APIRouter(prefix="/submissions", tags=["report-submissions"])

_PERIOD_RE = re.compile(r"^(\d{4})-(Q([1-4])|M(0[1-9]|1[0-2]))$")


def _parse_report_period(period: str) -> tuple[date, date, dict]:
    m = _PERIOD_RE.match(period)
    if not m:
        raise ValueError("Некорректный отчётный период (ожидается 2026-Q1 или 2026-M01).")
    year = int(m.group(1))
    if m.group(2).startswith("Q"):
        q = int(m.group(3))
        start_m = (q - 1) * 3 + 1
        end_m = q * 3
        d0 = date(year, start_m, 1)
        last = calendar.monthrange(year, end_m)[1]
        d1 = date(year, end_m, last)
        return d0, d1, {"kind": "quarter", "quarter": q, "year": year}
    month = int(m.group(4))
    d0 = date(year, month, 1)
    last = calendar.monthrange(year, month)[1]
    d1 = date(year, month, last)
    q = (month - 1) // 3 + 1
    return d0, d1, {"kind": "month", "month": month, "quarter": q, "year": year}


def _fmt_byn(amount: Decimal) -> str:
    q = amount.quantize(Decimal("0.01"))
    txt = f"{float(q):,.2f}".replace(",", " ")
    return f"{txt} BYN"


async def _sum_income_expense(
    db: AsyncSession, organization_id: str, period_start: date, period_end: date
) -> tuple[Decimal, Decimal]:
    inc_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "income",
                Transaction.transaction_date >= period_start,
                Transaction.transaction_date <= period_end,
            )
        )
    )
    exp_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= period_start,
                Transaction.transaction_date <= period_end,
            )
        )
    )
    return Decimal(str(inc_q.scalar())), Decimal(str(exp_q.scalar()))


async def _build_report_data(
    db: AsyncSession,
    organization_id: str,
    authority: str,
    report_type: str,
    report_period: str,
    org: Organization | None,
) -> dict:
    period_start, period_end, meta = _parse_report_period(report_period)
    rules = get_tax_rules_for_year(period_end.year)
    org_name = org.name if org else "Организация"
    org_unp = org.unp if org else "000000000"
    tax_regime = org.tax_regime if org else "usn_no_vat"

    base = {
        "organization": org_name,
        "unp": org_unp,
        "period": report_period,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "ledger",
        "warnings": [],
    }

    if authority == "imns" and report_type == "usn-declaration":
        income, expense = await _sum_income_expense(db, organization_id, period_start, period_end)
        if tax_regime not in ("usn_no_vat", "usn_vat"):
            base["warnings"].append(
                "Организация не на УСН в карточке — декларация УСН может не применяться; показаны расчётные суммы по доходам из учёта."
            )
        with_vat = tax_regime == "usn_vat"
        tr = calculate_usn(
            income,
            period_start,
            period_end,
            with_vat=with_vat,
            paid_before=Decimal("0"),
            usn_rate_with_vat=rules.usn_rate_with_vat,
            usn_rate_without_vat=rules.usn_rate_without_vat,
        )
        label = "УСН 3% (с НДС)" if with_vat else "УСН 5% (без НДС)"
        return {
            **base,
            "form": "Декларация по УСН",
            "tax_regime": label,
            "rules_version": rules.version,
            "revenue": _fmt_byn(tr.income),
            "tax_base": _fmt_byn(tr.tax_base),
            "tax_rate": f"{tr.usn_rate}%",
            "tax_amount": _fmt_byn(tr.usn_amount),
            "prepaid": _fmt_byn(tr.usn_paid),
            "to_pay": _fmt_byn(tr.usn_to_pay),
            "deadline": tr.deadline.isoformat(),
            "numeric": {
                "income": float(tr.income),
                "expense": float(expense),
                "usn_amount": float(tr.usn_amount),
                "usn_to_pay": float(tr.usn_to_pay),
            },
        }

    if authority == "imns" and report_type == "vat-declaration":
        sales, purchases = await _sum_income_expense(db, organization_id, period_start, period_end)
        vat_sales, vat_purchases, vat_to_pay, deadline = calculate_vat(
            sales, purchases, period_end, vat_rate=rules.vat_rate
        )
        return {
            **base,
            "form": "Декларация по НДС",
            "rules_version": rules.version,
            "sales_vat": _fmt_byn(vat_sales),
            "purchase_vat": _fmt_byn(vat_purchases),
            "vat_to_pay": _fmt_byn(vat_to_pay),
            "deadline": deadline.isoformat(),
            "numeric": {
                "sales_with_vat": float(sales),
                "purchases_with_vat": float(purchases),
                "vat_sales": float(vat_sales),
                "vat_purchases": float(vat_purchases),
                "vat_to_pay": float(vat_to_pay),
            },
        }

    if authority == "imns" and report_type == "income-tax":
        income, expense = await _sum_income_expense(db, organization_id, period_start, period_end)
        profit = income - expense
        rate = Decimal("0.18")
        tax = max(profit * rate, Decimal("0")).quantize(Decimal("0.01"))
        base["warnings"].append(
            "Упрощённый расчёт налога на прибыль (18%) по данным учёта; для ОСН уточните ставку и вычеты у бухгалтера."
        )
        return {
            **base,
            "form": "Налог на прибыль (черновик)",
            "revenue": _fmt_byn(income),
            "expenses": _fmt_byn(expense),
            "profit": _fmt_byn(profit),
            "rate": "18%",
            "tax_amount": _fmt_byn(tax),
            "numeric": {"income": float(income), "expense": float(expense), "profit": float(profit), "tax": float(tax)},
        }

    if authority == "fsszn" and report_type == "pu-3":
        year = meta["year"]
        if meta["kind"] == "quarter":
            months = list(range((meta["quarter"] - 1) * 3 + 1, meta["quarter"] * 3 + 1))
        else:
            months = [meta["month"]]

        sal_res = await db.execute(
            select(SalaryRecord).where(
                SalaryRecord.organization_id == organization_id,
                SalaryRecord.period_year == year,
                SalaryRecord.period_month.in_(months),
            )
        )
        records = sal_res.scalars().all()
        enc = get_encryptor()
        emp_ids = list({r.employee_id for r in records})
        emp_names: dict[str, str] = {}
        if emp_ids:
            emp_res = await db.execute(select(Employee).where(Employee.id.in_(emp_ids)))
            for e in emp_res.scalars().all():
                emp_names[e.id] = enc.decrypt(e.full_name_enc)

        agg: dict[str, dict] = {}
        for r in records:
            if r.employee_id not in agg:
                agg[r.employee_id] = {
                    "name": emp_names.get(r.employee_id, "—"),
                    "gross": Decimal("0"),
                    "employer": Decimal("0"),
                    "employee": Decimal("0"),
                }
            agg[r.employee_id]["gross"] += r.gross_salary
            agg[r.employee_id]["employer"] += r.fsszn_employer
            agg[r.employee_id]["employee"] += r.fsszn_employee

        rows = []
        total_gross = Decimal("0")
        total_employer = Decimal("0")
        total_employee = Decimal("0")
        for row in sorted(agg.values(), key=lambda x: x["name"]):
            g = row["gross"].quantize(Decimal("0.01"))
            emp = row["employer"].quantize(Decimal("0.01"))
            ee = row["employee"].quantize(Decimal("0.01"))
            total_gross += g
            total_employer += emp
            total_employee += ee
            rows.append(
                {
                    "fio": row["name"],
                    "salary": _fmt_byn(g).replace(" BYN", ""),
                    "fsszn": _fmt_byn(emp).replace(" BYN", ""),
                }
            )

        if not records:
            base["warnings"].append("Нет записей зарплаты за выбранный период в учёте — строки персонального учёта пустые.")

        return {
            **base,
            "form": "ПУ-3",
            "employees_count": len(agg),
            "total_fot": _fmt_byn(total_gross),
            "fsszn_34_percent": _fmt_byn(total_employer),
            "fsszn_1_percent": _fmt_byn(total_employee),
            "rows": rows,
            "numeric": {
                "employees_count": len(agg),
                "total_gross": float(total_gross),
                "total_employer": float(total_employer),
                "total_employee": float(total_employee),
            },
        }

    if authority == "fsszn" and report_type == "4-fund":
        income, _exp = await _sum_income_expense(db, organization_id, period_start, period_end)
        employer, employee, dl = calculate_fsszn(income, period_end)
        base["warnings"].append(
            "Форма 4-фонд: показан упрощённый расчёт от суммы доходов по проводкам как прокси ФОТ; при наличии зарплатного модуля сверьте с ПУ-3."
        )
        return {
            **base,
            "form": "4-фонд (упрощённо)",
            "proxy_fot_from_income": _fmt_byn(income),
            "employer_34": _fmt_byn(employer),
            "employee_1": _fmt_byn(employee),
            "deadline": dl.isoformat(),
            "numeric": {
                "proxy_income_as_fot": float(income),
                "employer": float(employer),
                "employee": float(employee),
            },
        }

    if authority == "belgosstrakh" and report_type == "insurance-report":
        year = meta["year"]
        if meta["kind"] == "quarter":
            months = list(range((meta["quarter"] - 1) * 3 + 1, meta["quarter"] * 3 + 1))
        else:
            months = [meta["month"]]
        sal_res = await db.execute(
            select(SalaryRecord).where(
                SalaryRecord.organization_id == organization_id,
                SalaryRecord.period_year == year,
                SalaryRecord.period_month.in_(months),
            )
        )
        records = sal_res.scalars().all()
        total_gross = sum((r.gross_salary for r in records), Decimal("0")).quantize(Decimal("0.01"))
        rate = Decimal("0.006")
        ins_amt = (total_gross * rate).quantize(Decimal("0.01"))
        if not records:
            base["warnings"].append("Нет начислений зарплаты за период — суммы нулевые.")
        return {
            **base,
            "form": "Отчёт по обязательному страхованию",
            "employees_count": len({r.employee_id for r in records}),
            "total_fot": _fmt_byn(total_gross),
            "insurance_rate": "0.6%",
            "insurance_amount": _fmt_byn(ins_amt),
            "numeric": {
                "total_gross": float(total_gross),
                "insurance_amount": float(ins_amt),
            },
        }

    if authority == "belstat" and report_type == "12-t":
        emp_res = await db.execute(
            select(func.count())
            .select_from(Employee)
            .where(
                Employee.organization_id == organization_id,
                Employee.is_active.is_(True),
            )
        )
        headcount = int(emp_res.scalar() or 0)

        year = meta["year"]
        if meta["kind"] == "quarter":
            months = list(range((meta["quarter"] - 1) * 3 + 1, meta["quarter"] * 3 + 1))
        else:
            months = [meta["month"]]
        sal_res = await db.execute(
            select(SalaryRecord).where(
                SalaryRecord.organization_id == organization_id,
                SalaryRecord.period_year == year,
                SalaryRecord.period_month.in_(months),
            )
        )
        records = sal_res.scalars().all()
        total_fot = sum((r.gross_salary for r in records), Decimal("0")).quantize(Decimal("0.01"))
        avg_salary = (total_fot / Decimal(headcount)).quantize(Decimal("0.01")) if headcount else Decimal("0")

        return {
            **base,
            "form": "Форма 12-т (краткая)",
            "avg_headcount": headcount,
            "total_fot": _fmt_byn(total_fot),
            "avg_salary": _fmt_byn(avg_salary),
            "numeric": {
                "headcount": headcount,
                "total_fot": float(total_fot),
                "avg_salary": float(avg_salary),
            },
        }

    if authority == "belstat" and report_type == "1-enterprise":
        income, expense = await _sum_income_expense(db, organization_id, period_start, period_end)
        profit = income - expense
        base["warnings"].append(
            "Форма 1-предприятие: упрощённая выручка/расходы из проводок FinKlik; полный баланс — из бухгалтерской отчётности."
        )
        return {
            **base,
            "form": "Форма 1-предприятие (упрощённо)",
            "revenue": _fmt_byn(income),
            "expenses": _fmt_byn(expense),
            "profit": _fmt_byn(profit),
            "numeric": {"income": float(income), "expense": float(expense), "profit": float(profit)},
        }

    return _generate_mock_report_data(authority, report_type, report_period, org)


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

    try:
        report_data = await _build_report_data(
            db,
            current_user.organization_id,
            body.authority,
            body.report_type,
            body.report_period,
            org,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

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
        "source": "mock",
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
