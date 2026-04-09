from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/onec", tags=["1c-integration"])

MOCK_COUNTERPARTIES = {
    "100000001": {"name": "ОАО Минский молочный завод №1", "unp": "100000001", "address": "г. Минск, ул. Маяковского, 108", "type": "Юридическое лицо", "account": "BY20AKBB30120000000040000000"},
    "100000002": {"name": "ООО ПромТехСервис", "unp": "100000002", "address": "г. Гомель, пр. Октября, 27", "type": "Юридическое лицо", "account": "BY86PJCB30120000000070000000"},
    "100000003": {"name": "ИП Петрова А.С.", "unp": "100000003", "address": "г. Брест, ул. Советская, 15", "type": "ИП", "account": "BY52BPSB30120000000050000000"},
    "100000004": {"name": "ООО Стройком", "unp": "100000004", "address": "г. Витебск, ул. Ленина, 42", "type": "Юридическое лицо", "account": "BY10BLBB30120000000060000000"},
    "100000005": {"name": "ЧПУП АйТиСервис", "unp": "100000005", "address": "г. Минск, пр. Независимости, 95", "type": "Юридическое лицо", "account": "BY44MTBK30120000000080000000"},
    "100000006": {"name": "ОАО Белтехностар", "unp": "100000006", "address": "г. Гродно, ул. Кирова, 10", "type": "Юридическое лицо", "account": "BY78AKBB30120000000090000000"},
    "100000007": {"name": "ИП Козлов Д.В.", "unp": "100000007", "address": "г. Могилёв, ул. Первомайская, 33", "type": "ИП", "account": "BY62BAPB30120000000100000000"},
    "100000008": {"name": "ООО ЛогистикПлюс", "unp": "100000008", "address": "г. Минск, ул. Тимирязева, 56", "type": "Юридическое лицо", "account": "BY39PJCB30120000000110000000"},
    "100000009": {"name": "ООО ЭкоПродукт", "unp": "100000009", "address": "г. Брест, ул. Московская, 88", "type": "Юридическое лицо", "account": "BY11AKBB30120000000120000000"},
    "100000010": {"name": "ЧТУП МаркетПлюс", "unp": "100000010", "address": "г. Гомель, пр. Победы, 12", "type": "Юридическое лицо", "account": "BY22BPSB30120000000130000000"},
    "100000011": {"name": "ИП Волкова Е.Н.", "unp": "100000011", "address": "г. Витебск, ул. Замковая, 7", "type": "ИП", "account": "BY33BLBB30120000000140000000"},
    "100000012": {"name": "ОАО АгроКомбинат", "unp": "100000012", "address": "г. Могилёв, ул. Крупской, 44", "type": "Юридическое лицо", "account": "BY44MTBK30120000000150000000"},
}

CHART_OF_ACCOUNTS = [
    {"code": "50", "name": "Касса", "type": "active"},
    {"code": "51", "name": "Расчётные счета", "type": "active"},
    {"code": "60", "name": "Расчёты с поставщиками", "type": "active-passive"},
    {"code": "62", "name": "Расчёты с покупателями", "type": "active-passive"},
    {"code": "68", "name": "Расчёты по налогам и сборам", "type": "passive"},
    {"code": "69", "name": "Расчёты по социальному страхованию", "type": "passive"},
    {"code": "70", "name": "Расчёты с персоналом по оплате труда", "type": "passive"},
    {"code": "71", "name": "Расчёты с подотчётными лицами", "type": "active-passive"},
    {"code": "76", "name": "Расчёты с разными дебиторами и кредиторами", "type": "active-passive"},
    {"code": "90", "name": "Доходы и расходы по текущей деятельности", "type": "active-passive"},
    {"code": "91", "name": "Прочие доходы и расходы", "type": "active-passive"},
    {"code": "99", "name": "Прибыли и убытки", "type": "active-passive"},
]


@router.get("/health")
async def onec_health(current_user: User = Depends(get_current_user)):
    return {
        "connected": True,
        "platform": "1С:Предприятие 8.3 (mock)",
        "infobase": "FinKlik_Demo",
        "mode": "mock",
    }


@router.get("/counterparty/lookup")
async def lookup_counterparty(
    unp: str = Query(..., min_length=9, max_length=9),
    current_user: User = Depends(get_current_user),
):
    cp = MOCK_COUNTERPARTIES.get(unp)
    if cp:
        return {"found": True, **cp}
    return {"found": False, "unp": unp, "message": "Контрагент не найден в 1С"}


@router.get("/counterparty/search")
async def search_counterparty(
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user),
):
    """Search counterparties by name in the mock 1C database."""
    q_lower = q.lower()
    results = [
        cp for cp in MOCK_COUNTERPARTIES.values()
        if q_lower in cp["name"].lower() or q_lower in cp["unp"]
    ]
    return {"results": results, "total": len(results)}


@router.get("/accounts")
async def get_chart_of_accounts(current_user: User = Depends(get_current_user)):
    return {"accounts": CHART_OF_ACCOUNTS}


@router.post("/sync-transaction")
async def sync_transaction_to_1c(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync a transaction to 1C (mock — marks as synced in DB)."""
    tx_id = body.get("transaction_id")
    if not tx_id:
        raise HTTPException(400, "transaction_id is required")

    from app.models.transaction import Transaction

    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.organization_id == current_user.organization_id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "Транзакция не найдена")

    tx.status = "synced"
    await db.flush()

    import uuid
    return {
        "synced": True,
        "onec_id": str(uuid.uuid4())[:8],
        "transaction_id": tx_id,
        "status": "synced",
    }
