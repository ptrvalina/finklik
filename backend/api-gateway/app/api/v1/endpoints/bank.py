from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, Field
import httpx

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.bank_account import BankAccount
from app.schemas.bank_import import StatementImportPayload

router = APIRouter(prefix="/bank", tags=["bank"])

BELARUSIAN_BANKS = [
    {"name": "Беларусбанк", "bic": "AKBBBY2X", "color": "#00875A"},
    {"name": "Белагропромбанк", "bic": "BAPBBY2X", "color": "#1E40AF"},
    {"name": "БПС-Сбербанк", "bic": "BPSBBY2X", "color": "#16A34A"},
    {"name": "Приорбанк", "bic": "PJCBBY2X", "color": "#DC2626"},
    {"name": "Белинвестбанк", "bic": "BLBBBY2X", "color": "#7C3AED"},
    {"name": "БНБ-Банк", "bic": "IRJSBY22", "color": "#059669"},
    {"name": "Альфа-Банк", "bic": "ALFABY2X", "color": "#EF4444"},
    {"name": "МТБанк", "bic": "MTBKBY22", "color": "#F59E0B"},
    {"name": "Банк Дабрабыт", "bic": "MMBNBY22", "color": "#6366F1"},
    {"name": "Технобанк", "bic": "TECHBY2X", "color": "#14B8A6"},
]


class BankAccountCreate(BaseModel):
    bank_name: str = Field(min_length=2, max_length=255)
    bank_bic: str = Field(min_length=4, max_length=20)
    account_number: str = Field(min_length=10, max_length=60)
    currency: str = "BYN"
    is_primary: bool = False


class BankAccountUpdate(BaseModel):
    is_primary: bool | None = None
    is_active: bool | None = None


class PaymentRequest(BaseModel):
    amount: float = Field(gt=0)
    recipient_name: str = Field(min_length=2)
    description: str = Field(min_length=2)
    account_id: str | None = None


@router.get("/banks")
async def list_available_banks():
    """Список доступных банков Беларуси."""
    return {"banks": BELARUSIAN_BANKS}


@router.get("/accounts")
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount)
        .where(BankAccount.organization_id == current_user.organization_id)
        .order_by(BankAccount.is_primary.desc(), BankAccount.created_at)
    )
    accounts = result.scalars().all()
    return {"accounts": [_account_to_dict(a) for a in accounts]}


@router.post("/accounts", status_code=201)
async def create_account(
    body: BankAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.is_primary:
        existing = await db.execute(
            select(BankAccount).where(
                BankAccount.organization_id == current_user.organization_id,
                BankAccount.is_primary == True,
            )
        )
        for acc in existing.scalars().all():
            acc.is_primary = False

    account = BankAccount(
        organization_id=current_user.organization_id,
        bank_name=body.bank_name,
        bank_bic=body.bank_bic,
        account_number=body.account_number,
        currency=body.currency,
        is_primary=body.is_primary,
    )
    db.add(account)
    await db.flush()
    return _account_to_dict(account)


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    body: BankAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            BankAccount.organization_id == current_user.organization_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Счёт не найден")

    if body.is_primary is True:
        all_accs = await db.execute(
            select(BankAccount).where(BankAccount.organization_id == current_user.organization_id)
        )
        for a in all_accs.scalars().all():
            a.is_primary = (a.id == account_id)

    if body.is_active is not None:
        account.is_active = body.is_active

    await db.flush()
    return _account_to_dict(account)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            BankAccount.organization_id == current_user.organization_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Счёт не найден")
    await db.delete(account)


@router.get("/balance")
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Balance = sum(income) - sum(expense) from real transactions."""
    from app.models.transaction import Transaction
    from sqlalchemy import func
    from decimal import Decimal

    org_id = current_user.organization_id

    income_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == org_id, Transaction.type == "income")
        )
    )
    expense_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == org_id, Transaction.type.in_(["expense", "writeoff"]))
        )
    )
    income = Decimal(str(income_q.scalar()))
    expense = Decimal(str(expense_q.scalar()))
    balance = income - expense

    primary = await db.execute(
        select(BankAccount).where(
            BankAccount.organization_id == org_id,
            BankAccount.is_primary == True,
        )
    )
    primary_acc = primary.scalar_one_or_none()

    from datetime import datetime, timezone
    return {
        "balance": float(balance),
        "currency": primary_acc.currency if primary_acc else "BYN",
        "account_number": primary_acc.account_number if primary_acc else "—",
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/statements")
async def get_statements(
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Statements based on real transactions."""
    from app.models.transaction import Transaction
    from sqlalchemy import func

    org_id = current_user.organization_id
    result = await db.execute(
        select(Transaction)
        .where(Transaction.organization_id == org_id)
        .order_by(Transaction.transaction_date.desc())
        .limit(limit)
    )
    txs = result.scalars().all()

    statements = []
    for tx in txs:
        statements.append({
            "id": tx.id,
            "date": str(tx.transaction_date),
            "amount": float(tx.amount),
            "type": "credit" if tx.type == "income" else "debit",
            "description": tx.description or tx.type,
            "counterparty": tx.counterparty_id or "—",
        })

    return {"transactions": statements, "total": len(statements)}


@router.post("/payment")
async def create_payment(
    body: PaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create payment as a new expense transaction."""
    from app.models.transaction import Transaction
    from app.cache.redis_cache import cache
    from datetime import date as d
    import uuid

    tx = Transaction(
        id=str(uuid.uuid4()),
        organization_id=current_user.organization_id,
        type="expense",
        amount=body.amount,
        description=f"Платёж: {body.description} → {body.recipient_name}",
        transaction_date=d.today(),
        status="confirmed",
    )
    db.add(tx)
    await db.flush()
    await cache.invalidate_org(str(current_user.organization_id))

    return {
        "status": "success",
        "payment_id": tx.id,
        "amount": body.amount,
        "recipient": body.recipient_name,
        "description": body.description,
    }


@router.post("/statement/import")
async def import_bank_statement(
    body: StatementImportPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Импорт строк выписки в транзакции (категория bank_import). Дубликаты по дате+сумме+описанию пропускаются."""
    from app.models.transaction import Transaction
    from app.cache.redis_cache import cache
    import uuid as uuid_mod

    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(400, "Нет организации")

    created = 0
    skipped = 0
    for line in body.lines:
        tx_type = "income" if line.direction == "credit" else "expense"
        amt = Decimal(str(round(line.amount, 2)))
        desc = line.description.strip()
        dup = await db.execute(
            select(Transaction.id).where(
                Transaction.organization_id == org_id,
                Transaction.category == "bank_import",
                Transaction.transaction_date == line.transaction_date,
                Transaction.amount == amt,
                Transaction.description == desc,
            ).limit(1)
        )
        if dup.scalar_one_or_none():
            skipped += 1
            continue
        db.add(
            Transaction(
                id=str(uuid_mod.uuid4()),
                organization_id=org_id,
                type=tx_type,
                amount=amt,
                description=desc,
                transaction_date=line.transaction_date,
                status="confirmed",
                category="bank_import",
            )
        )
        created += 1
    await db.flush()
    await cache.invalidate_org(str(org_id))
    return {"created": created, "skipped_duplicates": skipped, "total_lines": len(body.lines)}


@router.get("/reconciliation")
async def bank_reconciliation(
    date_from: date = Query(..., description="Начало периода"),
    date_to: date = Query(..., description="Конец периода"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Сверка: обороты по учёту и по импорту выписки за период."""
    from app.models.transaction import Transaction

    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(400, "Нет организации")
    if date_to < date_from:
        raise HTTPException(400, "date_to раньше date_from")

    def _sum_expr(tx_type: str, *, bank_import_only: bool):
        q = [
            Transaction.organization_id == org_id,
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
            Transaction.type == tx_type,
        ]
        if bank_import_only:
            q.append(Transaction.category == "bank_import")
        return select(func.coalesce(func.sum(Transaction.amount), 0)).where(and_(*q))

    book_income = Decimal(str((await db.execute(_sum_expr("income", bank_import_only=False))).scalar()))
    book_expense = Decimal(str((await db.execute(_sum_expr("expense", bank_import_only=False))).scalar()))
    bank_income = Decimal(str((await db.execute(_sum_expr("income", bank_import_only=True))).scalar()))
    bank_expense = Decimal(str((await db.execute(_sum_expr("expense", bank_import_only=True))).scalar()))

    cnt_book = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.organization_id == org_id,
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
            )
        )
    ).scalar() or 0
    cnt_bank = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.organization_id == org_id,
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
                Transaction.category == "bank_import",
            )
        )
    ).scalar() or 0

    net_book = book_income - book_expense
    net_bank_import = bank_income - bank_expense

    return {
        "period": {"date_from": str(date_from), "date_to": str(date_to)},
        "book": {
            "total_income": float(book_income),
            "total_expense": float(book_expense),
            "net": float(net_book),
            "transactions_count": int(cnt_book),
        },
        "bank_import": {
            "total_income": float(bank_income),
            "total_expense": float(bank_expense),
            "net": float(net_bank_import),
            "lines_count": int(cnt_bank),
        },
        "delta_net_book_minus_bank_import": float(net_book - net_bank_import),
    }


@router.get("/external-statement")
async def fetch_external_statement_preview(
    current_user: User = Depends(get_current_user),
):
    """Если задан MOCK_BANK_URL — пробуем получить демо-выписку для ручного импорта."""
    if not settings.MOCK_BANK_URL:
        return {
            "available": False,
            "error": "MOCK_BANK_URL не задан",
            "lines": [],
            "hint": "Задайте переменную окружения MOCK_BANK_URL или импортируйте JSON вручную",
        }
    url = settings.MOCK_BANK_URL.rstrip("/") + "/statement"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
            "hint": "Укажите MOCK_BANK_URL или используйте ручной JSON-импорт на фронте",
        }
    lines = data.get("lines") if isinstance(data, dict) else data
    if not isinstance(lines, list):
        lines = []
    return {"available": True, "lines": lines, "source": url}


def _account_to_dict(a: BankAccount) -> dict:
    bank_info = next((b for b in BELARUSIAN_BANKS if b["bic"] == a.bank_bic), None)
    return {
        "id": a.id,
        "bank_name": a.bank_name,
        "bank_bic": a.bank_bic,
        "account_number": a.account_number,
        "currency": a.currency,
        "is_primary": a.is_primary,
        "is_active": a.is_active,
        "color": bank_info["color"] if bank_info else "#6B7280",
        "created_at": a.created_at.isoformat(),
    }
