"""
Seed demo data for the demo@finklik.by user.
Run inside the backend container:
  python seed_demo.py
"""
import asyncio
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.core.database import engine, get_db, Base
from app.core.security import hash_password
from app.security.middleware import get_encryptor
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.user import User, Organization
from app.models.transaction import Transaction
from app.models.employee import Employee, SalaryRecord
from app.models.counterparty import Counterparty
from app.models.bank_account import BankAccount


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_gen = get_db()
    db: AsyncSession = await session_gen.__anext__()

    result = await db.execute(select(User).where(User.email == "demo@finklik.by"))
    user = result.scalar_one_or_none()
    if not user:
        print("User demo@finklik.by not found. Register first.")
        return

    org_id = str(user.organization_id)
    user_id = str(user.id)
    enc = get_encryptor()

    # --- Counterparties ---
    existing_cp = await db.execute(
        select(Counterparty).where(Counterparty.organization_id == org_id)
    )
    if not existing_cp.scalars().first():
        counterparties_data = [
            ("ООО «СтройМатериалы»", "100200300", "+375291234567", "info@stroymat.by"),
            ("ИП Иванов А.В.", "200300400", "+375297654321", "ivanov@mail.by"),
            ("ЗАО «ТехноСервис»", "300400500", "+375339876543", "tech@service.by"),
            ("ООО «Белтранс»", "400500600", "+375441112233", "logistics@beltrans.by"),
            ("ООО «ОфисПлюс»", "500600700", "+375255556677", "sales@officeplus.by"),
        ]
        cp_ids = []
        for name, unp, phone, email in counterparties_data:
            cp = Counterparty(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                name=name,
                unp=unp,
                phone=phone,
                email=email,
            )
            db.add(cp)
            cp_ids.append(cp.id)
        await db.flush()
        print(f"  Created {len(cp_ids)} counterparties")
    else:
        cp_result = await db.execute(
            select(Counterparty.id).where(Counterparty.organization_id == org_id)
        )
        cp_ids = [r[0] for r in cp_result.fetchall()]
        print(f"  Counterparties already exist ({len(cp_ids)})")

    # --- Transactions ---
    existing_tx = await db.execute(
        select(Transaction).where(Transaction.organization_id == org_id)
    )
    if not existing_tx.scalars().first():
        tx_data = [
            ("income", "Оплата за консультацию", 2500.00, "2026-03-01", "ООО «ТехноСервис»"),
            ("income", "Продажа товара (партия #12)", 8750.00, "2026-03-05", "ИП Иванов А.В."),
            ("expense", "Аренда офиса за март", 1200.00, "2026-03-03", "ООО «ОфисПлюс»"),
            ("expense", "Закупка материалов", 3400.00, "2026-03-07", "ООО «СтройМатериалы»"),
            ("income", "Оплата по договору #45", 15000.00, "2026-03-10", "ЗАО «ТехноСервис»"),
            ("expense", "Логистика — доставка товара", 650.00, "2026-03-12", "ООО «Белтранс»"),
            ("income", "Продажа услуг (сопровождение)", 4200.00, "2026-03-15", "ООО «ТехноСервис»"),
            ("expense", "Канцтовары для офиса", 180.00, "2026-03-18", "ООО «ОфисПлюс»"),
            ("refund", "Возврат за брак (партия #11)", 500.00, "2026-03-20", "ИП Иванов А.В."),
            ("income", "Оплата за обучение персонала", 3000.00, "2026-03-22", "ЗАО «ТехноСервис»"),
            ("expense", "ГСМ (топливо) за март", 420.00, "2026-03-25", None),
            ("income", "Предоплата апрель", 6000.00, "2026-03-28", "ООО «СтройМатериалы»"),
            ("income", "Оплата за проект «Альфа»", 12000.00, "2026-04-01", "ЗАО «ТехноСервис»"),
            ("expense", "Аренда офиса за апрель", 1200.00, "2026-04-02", "ООО «ОфисПлюс»"),
            ("expense", "Интернет + телефония", 95.00, "2026-04-03", None),
            ("income", "Продажа товара (партия #13)", 9800.00, "2026-04-05", "ИП Иванов А.В."),
            ("writeoff", "Списание просроченного товара", 300.00, "2026-04-06", None),
            ("expense", "Закупка комплектующих", 2700.00, "2026-04-07", "ООО «СтройМатериалы»"),
            ("income", "Оплата обслуживания за Q1", 7500.00, "2026-04-08", "ООО «Белтранс»"),
            ("expense", "Подписка ПО (лицензии)", 350.00, "2026-04-09", None),
        ]

        cp_name_map = {}
        for cid in cp_ids:
            cp_obj = await db.execute(select(Counterparty).where(Counterparty.id == cid))
            cp_o = cp_obj.scalar_one_or_none()
            if cp_o:
                cp_name_map[cp_o.name] = cp_o.id

        for tx_type, desc, amount, dt, cp_name in tx_data:
            tx = Transaction(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                type=tx_type,
                amount=Decimal(str(amount)),
                description=desc,
                transaction_date=date.fromisoformat(dt),
                counterparty_id=cp_name_map.get(cp_name) if cp_name else None,
            )
            db.add(tx)

        await db.flush()
        print(f"  Created {len(tx_data)} transactions")
    else:
        print("  Transactions already exist")

    # --- Employees ---
    existing_emp = await db.execute(
        select(Employee).where(Employee.organization_id == org_id)
    )
    if not existing_emp.scalars().first():
        employees_data = [
            ("Петров Сергей Иванович", "Разработчик", 3500.00),
            ("Козлова Анна Дмитриевна", "Бухгалтер", 2800.00),
            ("Сидоров Дмитрий Петрович", "Менеджер по продажам", 3200.00),
            ("Новикова Елена Алексеевна", "HR-специалист", 2500.00),
            ("Морозов Андрей Викторович", "Логист", 2900.00),
        ]

        emp_ids = []
        for full_name, position, salary in employees_data:
            emp = Employee(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                full_name_enc=enc.encrypt(full_name),
                position=position,
                salary=Decimal(str(salary)),
                hire_date=date(2025, 1, 15),
                is_active=True,
            )
            db.add(emp)
            emp_ids.append(emp.id)

        await db.flush()

        for emp_id in emp_ids:
            emp_obj = await db.execute(select(Employee).where(Employee.id == emp_id))
            e = emp_obj.scalar_one()
            base = float(e.salary)
            gross = base
            income_tax = round(gross * 0.13, 2)
            fsszn_emp = round(gross * 0.01, 2)
            net = round(gross - income_tax - fsszn_emp, 2)
            fsszn_employer = round(gross * 0.34, 2)
            for month in range(1, 4):
                sr = SalaryRecord(
                    id=str(uuid.uuid4()),
                    employee_id=emp_id,
                    organization_id=org_id,
                    period_year=2026,
                    period_month=month,
                    base_salary=Decimal(str(base)),
                    bonus=Decimal("0"),
                    income_tax=Decimal(str(income_tax)),
                    fsszn_employee=Decimal(str(fsszn_emp)),
                    gross_salary=Decimal(str(gross)),
                    net_salary=Decimal(str(net)),
                    fsszn_employer=Decimal(str(fsszn_employer)),
                    status="paid",
                    paid_at=datetime(2026, month, 25),
                )
                db.add(sr)

        await db.flush()
        print(f"  Created {len(emp_ids)} employees with salary history")
    else:
        print("  Employees already exist")

    # --- Bank Account ---
    existing_ba = await db.execute(
        select(BankAccount).where(BankAccount.organization_id == org_id)
    )
    if not existing_ba.scalars().first():
        ba = BankAccount(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            bank_name="Беларусбанк",
            bank_bic="AKBBBY2X",
            account_number="BY20AKBB30120000000000000000",
            currency="BYN",
            is_primary=True,
        )
        db.add(ba)
        await db.flush()
        print("  Created bank account")
    else:
        print("  Bank account already exists")

    await db.commit()
    print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
