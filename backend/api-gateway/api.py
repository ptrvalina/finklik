from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import uvicorn

app = FastAPI(title="Finklik API")

# Не используем allow_origins=["*"] вместе с credentials (некорректно и нестабильно в браузерах).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

users_db: Dict[str, dict] = {}

class UserLogin(BaseModel):
    email: str
    password: str

@app.get("/")
async def root():
    return {"message": "Finklik API"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "api-gateway"}

@app.post("/api/v1/auth/login")
async def login(user: UserLogin):
    if user.email not in users_db:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": "token_123", "token_type": "bearer"}

@app.post("/api/v1/auth/register")
async def register(user: UserLogin):
    if user.email in users_db:
        raise HTTPException(status_code=400, detail="Email exists")
    users_db[user.email] = {"email": user.email, "password": user.password}
    return {"access_token": "token_123", "token_type": "bearer"}

@app.get("/api/v1/dashboard")
async def dashboard():
    return {
        "total_revenue": 1250000,
        "total_expenses": 780000,
        "profit": 470000,
        "profit_margin": 37.6,
        "bank_balance": 250000
    }

# Добавляем тестового пользователя
users_db["test@example.com"] = {"email": "test@example.com", "password": "123456"}

if __name__ == "__main__":
    print("="*50)
    print("🚀 FINKLIK API GATEWAY")
    print("="*50)
    print("📍 Swagger UI: http://localhost:8000/docs")
    print("📍 Health: http://localhost:8000/health")
    print("🔐 Login: test@example.com / 123456")
    print("="*50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
