import csv
import io
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.models.transaction import Transaction
from app.cache.redis_cache import cache

router = APIRouter(
    prefix="/import",
    tags=["import"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)

VALID_TYPES = {"income", "expense", "refund", "writeoff"}

COLUMN_ALIASES = {
    "date": "transaction_date",
    "дата": "transaction_date",
    "дата операции": "transaction_date",
    "transaction_date": "transaction_date",

    "type": "type",
    "тип": "type",
    "тип операции": "type",

    "amount": "amount",
    "сумма": "amount",
    "сумма (byn)": "amount",

    "description": "description",
    "описание": "description",
    "назначение": "description",
    "назначение платежа": "description",

    "category": "category",
    "категория": "category",

    "vat": "vat_amount",
    "vat_amount": "vat_amount",
    "ндс": "vat_amount",
}

TYPE_ALIASES = {
    "доход": "income",
    "расход": "expense",
    "возврат": "refund",
    "списание": "writeoff",
    "income": "income",
    "expense": "expense",
    "refund": "refund",
    "writeoff": "writeoff",
    "приход": "income",
    "расход": "expense",
}


def _parse_date(s: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(s: str) -> Decimal | None:
    s = s.strip().replace(" ", "").replace("\xa0", "")
    s = s.replace(",", ".")
    if s.startswith("-"):
        s = s[1:]
    try:
        val = Decimal(s)
        return val if val > 0 else None
    except (InvalidOperation, ValueError):
        return None


@router.post("/transactions-csv/preview")
async def preview_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Parse CSV and return preview of rows + detected column mapping."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=_detect_delimiter(text))

    if not reader.fieldnames:
        raise HTTPException(400, "Не удалось распознать заголовки CSV")

    mapping = {}
    for col in reader.fieldnames:
        normalized = col.strip().lower()
        if normalized in COLUMN_ALIASES:
            mapping[col] = COLUMN_ALIASES[normalized]

    rows = []
    errors = []
    for i, raw in enumerate(reader):
        if i >= 200:
            break
        row = _map_row(raw, mapping)
        if row.get("_error"):
            errors.append({"row": i + 2, "error": row["_error"], "raw": raw})
        else:
            rows.append(row)

    return {
        "columns": list(reader.fieldnames),
        "mapping": mapping,
        "preview": rows[:50],
        "total_parsed": len(rows),
        "errors": errors[:20],
    }


@router.post("/transactions-csv")
async def import_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import transactions from CSV."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=_detect_delimiter(text))

    if not reader.fieldnames:
        raise HTTPException(400, "Не удалось распознать заголовки CSV")

    mapping = {}
    for col in reader.fieldnames:
        normalized = col.strip().lower()
        if normalized in COLUMN_ALIASES:
            mapping[col] = COLUMN_ALIASES[normalized]

    imported = 0
    errors = []
    for i, raw in enumerate(reader):
        row = _map_row(raw, mapping)
        if row.get("_error"):
            errors.append({"row": i + 2, "error": row["_error"]})
            continue

        tx = Transaction(
            id=str(uuid.uuid4()),
            organization_id=current_user.organization_id,
            type=row["type"],
            amount=Decimal(str(row["amount"])),
            vat_amount=Decimal(str(row.get("vat_amount", 0))),
            category=row.get("category"),
            description=row.get("description"),
            transaction_date=row["transaction_date"],
            status="draft",
        )
        db.add(tx)
        imported += 1

    if imported > 0:
        await db.flush()
        await cache.invalidate_org(str(current_user.organization_id))

    return {
        "imported": imported,
        "errors": errors[:50],
        "total_rows": imported + len(errors),
    }


def _detect_delimiter(text: str) -> str:
    first_line = text.split("\n")[0]
    if ";" in first_line:
        return ";"
    if "\t" in first_line:
        return "\t"
    return ","


def _map_row(raw: dict, mapping: dict) -> dict:
    mapped: dict = {}
    for orig_col, target in mapping.items():
        val = raw.get(orig_col, "").strip()
        if val:
            mapped[target] = val

    if "transaction_date" not in mapped:
        return {"_error": "Нет даты"}
    parsed_date = _parse_date(mapped["transaction_date"])
    if not parsed_date:
        return {"_error": f"Некорректная дата: {mapped['transaction_date']}"}
    mapped["transaction_date"] = parsed_date.isoformat()

    if "amount" not in mapped:
        return {"_error": "Нет суммы"}
    parsed_amount = _parse_amount(mapped["amount"])
    if not parsed_amount:
        return {"_error": f"Некорректная сумма: {mapped['amount']}"}
    mapped["amount"] = float(parsed_amount)

    if "type" in mapped:
        t = mapped["type"].strip().lower()
        mapped["type"] = TYPE_ALIASES.get(t, t)
    if mapped.get("type") not in VALID_TYPES:
        mapped["type"] = "expense"

    if "vat_amount" in mapped:
        vat = _parse_amount(mapped["vat_amount"])
        mapped["vat_amount"] = float(vat) if vat else 0
    else:
        mapped["vat_amount"] = 0

    return mapped
