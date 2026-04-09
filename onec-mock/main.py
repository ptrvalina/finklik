from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import uuid

app = FastAPI(title="ФинКлик Mock 1С")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB = {
    "counterparties": {
        "100326260": {"name": "ООО РОМАШКА", "unp": "100326260", "vat_registered": True},
        "691302345": {"name": "ИП Петров Пётр Петрович", "unp": "691302345", "vat_registered": False},
    }
}


def ok(data):
    return {"success": True, "data": data, "meta": {"timestamp": datetime.now(timezone.utc).isoformat()}}


@app.get("/health")
def health():
    return ok({"status": "ok", "platform": "8.3.24", "infobase": "finklik"})


@app.get("/counterparty/by-unp/{unp}")
def get_counterparty(unp: str):
    if len(unp) != 9 or not unp.isdigit():
        raise HTTPException(400, detail={"success": False, "error": "УНП должен быть 9 цифр"})
    cp = DB["counterparties"].get(unp)
    if not cp:
        raise HTTPException(404, detail={"success": False, "error": f"Контрагент {unp} не найден"})
    return ok(cp)


@app.get("/accounts")
def get_accounts():
    accounts = [
        {"code": "50", "name": "Касса"}, {"code": "51", "name": "Расчётные счета"},
        {"code": "60", "name": "Расчёты с поставщиками"}, {"code": "62", "name": "Расчёты с покупателями"},
        {"code": "90", "name": "Доходы от реализации"},
    ]
    return ok({"accounts": accounts})


@app.post("/transactions")
def create_transaction(body: dict):
    ref = str(uuid.uuid4()).replace("-", "")
    return ok({"ref": ref, "status": "posted", "number": body.get("number", "AUTO")})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
