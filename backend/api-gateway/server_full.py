from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
from datetime import datetime
import uvicorn

app = FastAPI(title="Finklik API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Хранилища
users_db: Dict[str, dict] = {}
transactions_db: List[dict] = []
employees_db: List[dict] = []
documents_db: List[dict] = []
transaction_id = 1
employee_id = 1
document_id = 1

# Модели
class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    org_name: str
    org_unp: str

class UserLogin(BaseModel):
    email: str
    password: str

class TransactionCreate(BaseModel):
    amount: float
    type: str
    category: str
    description: str = ""

class EmployeeCreate(BaseModel):
    name: str
    position: str
    salary: float
    phone: str = ""

class DocumentCreate(BaseModel):
    name: str
    type: str
    number: str
    date: str

# Тестовые данные
employees_db = [
    {"id": 1, "name": "Иван Иванов", "position": "Главный бухгалтер", "salary": 2000, "phone": "+375291234567"},
]

documents_db = [
    {"id": 1, "name": "Счет-фактура №45", "type": "invoice", "number": "45", "date": "2026-04-01", "status": "completed"},
]

# Эндпоинты
@app.get("/")
async def root():
    return {"message": "Finklik API Gateway"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "api-gateway"}

@app.post("/api/v1/auth/register")
async def register(user: UserRegister):
    if user.email in users_db:
        raise HTTPException(status_code=400, detail="Email exists")
    
    users_db[user.email] = {
        "email": user.email,
        "password": user.password,
        "full_name": user.full_name,
        "org_name": user.org_name,
        "org_unp": user.org_unp
    }
    return {"access_token": f"token_{user.email}", "token_type": "bearer"}

@app.post("/api/v1/auth/login")
async def login(user: UserLogin):
    db_user = users_db.get(user.email)
    if not db_user or db_user["password"] != user.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": f"token_{user.email}", "token_type": "bearer"}

@app.get("/api/v1/auth/me")
async def get_me():
    return {"email": "test@example.com", "full_name": "Test User", "org_name": "Test Org", "org_unp": "123456789"}

@app.get("/api/v1/dashboard")
async def dashboard():
    revenue = 1250000
    expenses = 780000
    profit = revenue - expenses
    return {
        "total_revenue": revenue,
        "total_expenses": expenses,
        "profit": profit,
        "profit_margin": round(profit / revenue * 100, 2),
        "bank_balance": 250000,
        "taxes": {
            "usn": round(revenue * 0.03, 2),
            "vat": round(revenue * 0.20, 2),
            "fszn": round(expenses * 0.34, 2),
            "total": round(revenue * 0.03 + revenue * 0.20 + expenses * 0.34, 2)
        }
    }

@app.get("/api/v1/transactions")
async def get_transactions():
    return transactions_db

@app.post("/api/v1/transactions")
async def create_transaction(transaction: TransactionCreate):
    global transaction_id
    new_transaction = {
        "id": transaction_id,
        "amount": transaction.amount,
        "type": transaction.type,
        "category": transaction.category,
        "description": transaction.description,
        "date": datetime.now().strftime("%Y-%m-%d")
    }
    transactions_db.append(new_transaction)
    transaction_id += 1
    return new_transaction

@app.get("/api/v1/employees")
async def get_employees():
    return employees_db

@app.post("/api/v1/employees")
async def create_employee(employee: EmployeeCreate):
    global employee_id
    new_employee = {
        "id": employee_id,
        "name": employee.name,
        "position": employee.position,
        "salary": employee.salary,
        "phone": employee.phone
    }
    employees_db.append(new_employee)
    employee_id += 1
    return new_employee

@app.delete("/api/v1/employees/{employee_id}")
async def delete_employee(employee_id: int):
    global employees_db
    employees_db = [e for e in employees_db if e["id"] != employee_id]
    return {"message": "Employee deleted"}

@app.get("/api/v1/documents")
async def get_documents():
    return documents_db

@app.post("/api/v1/documents")
async def create_document(document: DocumentCreate):
    global document_id
    new_document = {
        "id": document_id,
        "name": document.name,
        "type": document.type,
        "number": document.number,
        "date": document.date,
        "status": "pending"
    }
    documents_db.append(new_document)
    document_id += 1
    return new_document

@app.get("/api/v1/reports/tax")
async def get_tax_report():
    revenue = 1250000
    expenses = 780000
    return {
        "usn": round(revenue * 0.03, 2),
        "vat": round(revenue * 0.20, 2),
        "fszn": round(expenses * 0.34, 2),
        "total": round(revenue * 0.03 + revenue * 0.20 + expenses * 0.34, 2),
        "deadline": "2026-04-22"
    }

@app.get("/api/v1/bank/balance")
async def get_bank_balance():
    return {"balance": 250000, "currency": "BYN", "account": "BY00XXXX00000000000000"}

# Добавляем тестового пользователя
users_db["test@example.com"] = {
    "email": "test@example.com",
    "password": "123456",
    "full_name": "Test User",
    "org_name": "Test Org",
    "org_unp": "123456789"
}

if __name__ == "__main__":
    print("="*50)
    print("FINKLIK API GATEWAY")
    print("="*50)
    print("Swagger UI: http://localhost:8000/docs")
    print("Health: http://localhost:8000/health")
    print("Login: test@example.com / 123456")
    print("="*50)
    uvicorn.run(app, host="0.0.0.0", port=8000)