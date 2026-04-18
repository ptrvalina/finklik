from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, Organization
from app.models.transaction import Transaction
from app.models.employee import SalaryRecord, Employee
from app.services.export_service import (
    export_transactions_csv,
    export_salary_csv,
    export_tax_report_txt,
    export_vat_declaration_txt,
    export_fsszn_pu3_txt,
)
from app.services.pdf_service import generate_financial_report_pdf
from app.services.pu3_aggregation import build_pu3_aggregates
from decimal import Decimal
from app.security import get_encryptor

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/transactions.csv")
async def download_transactions_csv(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.organization_id == current_user.organization_id,
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
            )
        ).order_by(Transaction.transaction_date)
    )
    txs = result.scalars().all()
    data = [
        {
            "transaction_date": str(t.transaction_date),
            "type": t.type,
            "amount": float(t.amount),
            "vat_amount": float(t.vat_amount),
            "category": t.category or "",
            "description": t.description or "",
            "status": t.status,
        }
        for t in txs
    ]
    csv_bytes = export_transactions_csv(data)
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename=transactions_{date_from}_{date_to}.csv"},
    )


@router.get("/salary.csv")
async def download_salary_csv(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()

    salary_result = await db.execute(
        select(SalaryRecord).where(
            SalaryRecord.organization_id == current_user.organization_id,
            SalaryRecord.period_year == year,
            SalaryRecord.period_month == month,
        )
    )
    records = salary_result.scalars().all()

    # Получаем имена сотрудников
    emp_ids = list({r.employee_id for r in records})
    emp_result = await db.execute(
        select(Employee).where(Employee.id.in_(emp_ids))
    )
    emp_map = {}
    for e in emp_result.scalars().all():
        emp_map[e.id] = {"name": enc.decrypt(e.full_name_enc), "position": e.position}
    employees = {eid: info["name"] for eid, info in emp_map.items()}

    data = [
        {
            "employee_id": r.employee_id,
            "position": emp_map.get(r.employee_id, {}).get("position", ""),
            "base_salary": float(r.base_salary),
            "bonus": float(r.bonus),
            "gross_salary": float(r.gross_salary),
            "income_tax": float(r.income_tax),
            "fsszn_employee": float(r.fsszn_employee),
            "net_salary": float(r.net_salary),
            "fsszn_employer": float(r.fsszn_employer),
            "status": r.status,
        }
        for r in records
    ]
    csv_bytes = export_salary_csv(data, employees)
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename=salary_{year}_{month:02d}.csv"},
    )


@router.get("/tax-report.txt")
async def download_tax_report(
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "Организация"
    unp = org.unp if org else "000000000"

    income_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == current_user.organization_id,
                 Transaction.type == "income",
                 Transaction.transaction_date >= period_start,
                 Transaction.transaction_date <= period_end)
        )
    )
    income_val = float(income_q.scalar())

    expense_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == current_user.organization_id,
                 Transaction.type == "expense",
                 Transaction.transaction_date >= period_start,
                 Transaction.transaction_date <= period_end)
        )
    )
    expense_val = float(expense_q.scalar())

    tax_base = income_val
    usn_amount = round(income_val * 0.03, 2)
    vat_sales = round(income_val * 0.20 / 1.20, 2)
    vat_purchases = round(expense_val * 0.20 / 1.20, 2)
    vat_to_pay = round(vat_sales - vat_purchases, 2)

    txt_bytes = export_tax_report_txt(
        tax_data={
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "income": income_val,
            "expense": expense_val,
            "tax_base": tax_base,
            "usn_rate": 3,
            "usn_amount": usn_amount,
            "usn_paid": 0,
            "usn_to_pay": usn_amount,
            "vat_sales": vat_sales,
            "vat_purchases": vat_purchases,
            "vat_to_pay": max(vat_to_pay, 0),
            "fsszn_fot": 0,
            "fsszn_employer_amount": 0,
            "fsszn_employee_amount": 0,
            "total_to_pay": round(usn_amount + max(vat_to_pay, 0), 2),
            "deadline": "",
        },
        org_name=org_name,
        unp=unp,
    )
    return Response(
        content=txt_bytes,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=tax_report_{period_start}_{period_end}.txt"},
    )


@router.get("/vat-declaration.txt")
async def download_vat_declaration(
    quarter: int = Query(..., ge=1, le=4),
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.tax_calculator import calculate_vat
    from decimal import Decimal

    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "Организация"
    unp = org.unp if org else "000000000"

    import calendar
    q_start_month = (quarter - 1) * 3 + 1
    q_start = date(year, q_start_month, 1)
    q_end_month = quarter * 3
    last_day = calendar.monthrange(year, q_end_month)[1]
    q_end = date(year, q_end_month, last_day)

    income_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == current_user.organization_id,
                Transaction.type == "income",
                Transaction.transaction_date >= q_start,
                Transaction.transaction_date <= q_end,
            )
        )
    )
    sales = Decimal(str(income_q.scalar()))

    expense_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == current_user.organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= q_start,
                Transaction.transaction_date <= q_end,
            )
        )
    )
    purchases = Decimal(str(expense_q.scalar()))

    vat_sales, vat_purchases, vat_to_pay, deadline = calculate_vat(sales, purchases, q_end)

    txt_bytes = export_vat_declaration_txt(
        org_name=org_name,
        unp=unp,
        quarter=quarter,
        year=year,
        sales=sales,
        purchases=purchases,
        vat_sales=vat_sales,
        vat_purchases=vat_purchases,
        vat_to_pay=vat_to_pay,
        deadline=deadline,
    )
    return Response(
        content=txt_bytes,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=vat_declaration_Q{quarter}_{year}.txt"},
    )


@router.get("/fsszn-pu3.txt")
async def download_fsszn_pu3(
    quarter: int = Query(..., ge=1, le=4),
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()

    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "Организация"
    unp = org.unp if org else "000000000"

    q_months = [(quarter - 1) * 3 + m for m in range(1, 4)]

    salary_result = await db.execute(
        select(SalaryRecord).where(
            SalaryRecord.organization_id == current_user.organization_id,
            SalaryRecord.period_year == year,
            SalaryRecord.period_month.in_(q_months),
        )
    )
    records = salary_result.scalars().all()

    emp_ids = list({r.employee_id for r in records})
    emp_result = await db.execute(
        select(Employee).where(Employee.id.in_(emp_ids))
    ) if emp_ids else None
    emp_names = {}
    if emp_result:
        emp_names = {e.id: enc.decrypt(e.full_name_enc) for e in emp_result.scalars().all()}

    pu3 = build_pu3_aggregates(records, emp_names)

    txt_bytes = export_fsszn_pu3_txt(
        org_name=org_name,
        unp=unp,
        quarter=quarter,
        year=year,
        employees_data=pu3.employees_data,
        total_fot=pu3.total_fot,
        total_employer=pu3.total_employer,
        total_employee=pu3.total_employee,
    )
    return Response(
        content=txt_bytes,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=fsszn_pu3_Q{quarter}_{year}.txt"},
    )


@router.get("/financial-report.pdf")
async def download_financial_report_pdf(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a PDF financial report for a given period."""
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "Организация"
    unp = org.unp if org else "000000000"

    income_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == current_user.organization_id,
                 Transaction.type == "income",
                 Transaction.transaction_date >= date_from,
                 Transaction.transaction_date <= date_to)
        )
    )
    income_val = float(income_q.scalar())

    expense_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == current_user.organization_id,
                 Transaction.type == "expense",
                 Transaction.transaction_date >= date_from,
                 Transaction.transaction_date <= date_to)
        )
    )
    expense_val = float(expense_q.scalar())

    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.organization_id == current_user.organization_id,
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
            )
        ).order_by(Transaction.transaction_date)
    )
    txs = result.scalars().all()
    tx_data = [
        {
            "transaction_date": str(t.transaction_date),
            "type": t.type,
            "amount": float(t.amount),
            "description": t.description or "",
        }
        for t in txs
    ]

    tax_usn = round(income_val * 0.03, 2)
    vat_sales = round(income_val * 0.20 / 1.20, 2)
    vat_purchases = round(expense_val * 0.20 / 1.20, 2)
    tax_vat = max(vat_sales - vat_purchases, 0)

    pdf_bytes = generate_financial_report_pdf(
        org_name=org_name,
        unp=unp,
        period_start=date_from,
        period_end=date_to,
        income=income_val,
        expense=expense_val,
        tax_usn=tax_usn,
        tax_vat=tax_vat,
        transactions=tx_data,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=financial_report_{date_from}_{date_to}.pdf"},
    )
