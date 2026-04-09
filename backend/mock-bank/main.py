from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
import uuid

app = FastAPI(title="ФинКлик Mock Банк")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STATE = {
    "balance": Decimal("15847.32"),
    "statements": [
        {"id": str(uuid.uuid4()), "date": (date.today() - timedelta(days=i)).isoformat(),
         "amount": amt, "description": desc, "type": typ, "counterparty": cp}
        for i, (amt, desc, typ, cp) in enumerate([
            (1250.00, "Оплата по договору №12/2024", "credit", "ООО РОМАШКА"),
            (-340.50, "Аренда офиса январь", "debit", "ИП Петров П.П."),
            (3600.00, "Услуги разработки ПО", "credit", "ЗАО ТЕХНОЛОГИИ"),
            (-89.99, "Канцелярия", "debit", "ОАО Офис-маркет"),
            (875.00, "Консультационные услуги", "credit", "ИП Сидоров С.С."),
            (-220.00, "Интернет + телефон", "debit", "A1 Беларусь"),
            (2100.00, "Проект внедрения CRM", "credit", "ООО БИЗНЕС"),
            (-450.00, "Командировочные", "debit", "Внутренний"),
            (-180.00, "Бухгалтерское сопровождение", "debit", "ООО Аудит-Бел"),
            (520.00, "Лицензии ПО", "credit", "ООО СофтЛайн"),
            (-95.40, "Хостинг и домен", "debit", "ООО Хостер"),
            (-1200.00, "Закупка оборудования", "debit", "ОАО ТехноСнаб"),
            (430.00, "Абонентское обслуживание", "credit", "ИП Козлов Д.В."),
            (-67.50, "Подписка SaaS", "debit", "ООО CloudBY"),
        ])
    ],
}


class PaymentRequest(BaseModel):
    amount: Decimal
    recipient_name: str
    description: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "mock-bank"}


@app.get("/balance")
def get_balance():
    return {
        "balance": float(STATE["balance"]),
        "currency": "BYN",
        "account_number": "BY20MOCK30122919200000000000",
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/statements")
def get_statements(limit: int = 20):
    return {"transactions": STATE["statements"][:limit], "total": len(STATE["statements"])}


@app.post("/payment")
def create_payment(body: PaymentRequest):
    if body.amount > STATE["balance"]:
        return {"status": "failed", "message": f"Недостаточно средств. Доступно: {STATE['balance']} BYN"}
    STATE["balance"] -= body.amount
    payment_id = str(uuid.uuid4())
    STATE["statements"].insert(0, {
        "id": payment_id, "date": date.today().isoformat(),
        "amount": -float(body.amount), "description": body.description,
        "type": "debit", "counterparty": body.recipient_name,
    })
    return {"payment_id": payment_id, "status": "completed", "amount": float(body.amount)}


@app.post("/deposit")
def deposit(amount: float):
    STATE["balance"] += Decimal(str(amount))
    return {"balance": float(STATE["balance"]), "deposited": amount}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
