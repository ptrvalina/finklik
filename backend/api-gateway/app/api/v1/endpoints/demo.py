"""Demo data seed endpoint for new users."""
import uuid
import random
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.models.counterparty import Counterparty
from app.cache.redis_cache import cache

router = APIRouter(prefix="/demo", tags=["demo"])

SAMPLE_COUNTERPARTIES = [
    {"name": "ОАО Минский молочный завод", "unp": "100001001", "contact_person": "Иванов А.П.", "phone": "+375291001010", "email": "mmz@example.by"},
    {"name": "ООО БелПромСервис", "unp": "100002002", "contact_person": "Козлова М.В.", "phone": "+375292002020", "email": "bps@example.by"},
    {"name": "ЧПУП АйТиСервис", "unp": "100003003", "contact_person": "Сидоров Д.К.", "phone": "+375293003030", "email": "its@example.by"},
    {"name": "ИП Петрова А.С.", "unp": "100004004", "contact_person": "Петрова А.С.", "phone": "+375294004040", "email": "petrova@example.by"},
    {"name": "ООО Стройком", "unp": "100005005", "contact_person": "Федоренко Н.И.", "phone": "+375295005050", "email": "stroykom@example.by"},
]

INCOME_DESCRIPTIONS = [
    "Оплата по договору поставки", "Оплата за услуги",
    "Предоплата по заказу", "Поступление от контрагента",
    "Оплата по счёту", "Выручка от продажи товаров",
]

EXPENSE_DESCRIPTIONS = {
    "salary": ["Заработная плата", "Аванс сотрудникам", "Премия"],
    "rent": ["Аренда офиса", "Аренда склада"],
    "materials": ["Закупка материалов", "Канцтовары", "Закупка сырья"],
    "marketing": ["Рекламная кампания", "Продвижение в интернете"],
    "utilities": ["Электричество", "Водоснабжение", "Интернет"],
    "transport": ["ГСМ", "Транспортные услуги", "Доставка грузов"],
    "services": ["Бухгалтерские услуги", "Юридическая консультация", "IT поддержка"],
    "other": ["Прочие расходы", "Разное"],
}


@router.post("/seed")
async def seed_demo_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fills the current organization with realistic demo data."""
    org_id = current_user.organization_id

    existing_tx = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.organization_id == org_id)
    )
    tx_count = existing_tx.scalar() or 0
    if tx_count > 50:
        return {"message": "Данные уже есть", "transactions": tx_count, "seeded": False}

    counterparties = []
    for cp_data in SAMPLE_COUNTERPARTIES:
        existing = await db.execute(
            select(Counterparty).where(
                Counterparty.organization_id == org_id,
                Counterparty.unp == cp_data["unp"],
            )
        )
        if existing.scalar_one_or_none():
            continue
        cp = Counterparty(
            organization_id=org_id,
            name=cp_data["name"],
            unp=cp_data["unp"],
            phone=cp_data["phone"],
            email=cp_data["email"],
            notes=cp_data.get("contact_person"),
        )
        db.add(cp)
        await db.flush()
        counterparties.append(cp)

    all_cp = await db.execute(
        select(Counterparty).where(Counterparty.organization_id == org_id)
    )
    cp_list = all_cp.scalars().all()
    cp_ids = [cp.id for cp in cp_list] if cp_list else [None]

    today = date.today()
    categories = list(EXPENSE_DESCRIPTIONS.keys())
    new_txs = 0

    for days_back in range(180):
        tx_date = today - timedelta(days=days_back)
        if tx_date.weekday() >= 5 and random.random() > 0.2:
            continue

        if random.random() < 0.6:
            amount = round(random.uniform(500, 25000), 2)
            vat = round(amount * 0.2 / 1.2, 2)
            tx = Transaction(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                type="income",
                amount=Decimal(str(amount)),
                vat_amount=Decimal(str(vat)),
                counterparty_id=random.choice(cp_ids),
                description=random.choice(INCOME_DESCRIPTIONS),
                transaction_date=tx_date,
                status="confirmed",
            )
            db.add(tx)
            new_txs += 1

        num_expenses = random.randint(0, 3)
        for _ in range(num_expenses):
            cat = random.choice(categories)
            descs = EXPENSE_DESCRIPTIONS[cat]
            amount = round(random.uniform(50, 8000), 2)
            vat = round(amount * 0.2 / 1.2, 2) if random.random() > 0.3 else 0
            tx = Transaction(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                type="expense",
                amount=Decimal(str(amount)),
                vat_amount=Decimal(str(vat)),
                category=cat,
                counterparty_id=random.choice(cp_ids) if random.random() > 0.4 else None,
                description=random.choice(descs),
                transaction_date=tx_date,
                status="confirmed",
            )
            db.add(tx)
            new_txs += 1

    await db.flush()
    await cache.invalidate_org(str(org_id))

    return {
        "seeded": True,
        "transactions": new_txs,
        "counterparties": len(counterparties),
        "message": f"Создано {new_txs} операций и {len(counterparties)} контрагентов",
    }
