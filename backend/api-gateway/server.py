from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/v1/auth/login")
async def login():
    return {"access_token": "token", "token_type": "bearer"}

@app.get("/api/v1/dashboard")
async def dashboard():
    return {
        "total_revenue": 1250000,
        "total_expenses": 780000,
        "profit": 470000,
        "bank_balance": 250000,
        "taxes": {"usn": 37500, "vat": 250000, "fszn": 265200}
    }

if __name__ == "__main__":
    print("="*40)
    print("API Gateway running on port 8000")
    print("Swagger: http://localhost:8000/docs")
    print("="*40)
    uvicorn.run(app, host="0.0.0.0", port=8000)