from urllib.parse import urlencode, urljoin

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.security.ssrf import validate_outbound_http_url
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.counterparty import Counterparty
from app.models.onec import OneCAccount, OneCConnection
from app.models.onec_sync import OneCSyncJob
from app.models.transaction import Transaction
from app.models.user import User
from app.services.pipeline_status import get_transaction_validation_issues
from app.services.onec_sync_service import (
    enqueue_sync_job,
    process_onec_sync_jobs_once,
    recover_stuck_sync_jobs,
    reset_sync_job_for_retry,
)

router = APIRouter(
    prefix="/onec",
    tags=["1c-integration"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)

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


class OneCConfigPayload(BaseModel):
    endpoint: HttpUrl
    token: str = Field(min_length=8, max_length=4096)
    protocol: str = Field(default="custom-http", max_length=20)


class OneCSyncTransactionPayload(BaseModel):
    transaction_id: str = Field(min_length=8, max_length=64)
    max_attempts: int = Field(default=3, ge=1, le=10)


async def _validate_onec_endpoint(endpoint: HttpUrl) -> None:
    validate_outbound_http_url(
        str(endpoint),
        invalid="Некорректный endpoint 1С",
        https_required="Для production разрешен только https endpoint 1С",
        resolve_failed="Не удалось разрешить хост endpoint 1С",
        private_literal="Приватные/локальные адреса 1С запрещены",
        private_resolved="Endpoint 1С резолвится в приватную/локальную сеть",
    )


async def _get_onec_connection(db: AsyncSession, organization_id: str | None) -> OneCConnection | None:
    if not organization_id:
        return None
    result = await db.execute(
        select(OneCConnection).where(OneCConnection.organization_id == organization_id)
    )
    return result.scalar_one_or_none()


def _token_mask(token: str) -> str:
    if len(token) <= 6:
        return "***"
    return f"{token[:3]}***{token[-3:]}"


async def _onec_get(connection: OneCConnection, path: str) -> object:
    url = urljoin(connection.endpoint.rstrip("/") + "/", path.lstrip("/"))
    headers = {"Authorization": f"Bearer {connection.token}"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


def _extract_items(payload: object, key: str) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        direct = payload.get(key)
        if isinstance(direct, list):
            return [item for item in direct if isinstance(item, dict)]
        odata = payload.get("value")
        if isinstance(odata, list):
            return [item for item in odata if isinstance(item, dict)]
    return []


@router.get("/config")
async def get_onec_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await _get_onec_connection(db, current_user.organization_id)
    if not connection:
        return {"configured": False}
    return {
        "configured": True,
        "endpoint": connection.endpoint,
        "protocol": connection.protocol,
        "token_masked": _token_mask(connection.token),
    }


@router.put("/config")
async def upsert_onec_config(
    body: OneCConfigPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")
    await _validate_onec_endpoint(body.endpoint)

    connection = await _get_onec_connection(db, current_user.organization_id)
    if connection:
        connection.endpoint = str(body.endpoint)
        connection.token = body.token
        connection.protocol = body.protocol
    else:
        connection = OneCConnection(
            organization_id=current_user.organization_id,
            endpoint=str(body.endpoint),
            token=body.token,
            protocol=body.protocol,
        )
        db.add(connection)
    await db.flush()
    return {"saved": True}


@router.get("/health")
async def onec_health(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.onec_contour_service import update_contour_health_snapshot

    connection = await _get_onec_connection(db, current_user.organization_id)
    if not connection:
        await update_contour_health_snapshot(
            db, current_user.organization_id, ok=True, error=None
        )
        return {
            "connected": True,
            "platform": "1С:Предприятие 8.3 (mock)",
            "infobase": "FinKlik_Demo",
            "mode": "mock",
        }

    try:
        payload = await _onec_get(connection, "/health")
        if not isinstance(payload, dict):
            payload = {}
        await update_contour_health_snapshot(
            db, current_user.organization_id, ok=True, error=None
        )
        return {
            "connected": True,
            "mode": "remote",
            "endpoint": connection.endpoint,
            "platform": payload.get("platform", "1С"),
            "infobase": payload.get("infobase", "unknown"),
        }
    except httpx.HTTPError as exc:
        await update_contour_health_snapshot(
            db, current_user.organization_id, ok=False, error=str(exc)
        )
        return {
            "connected": False,
            "mode": "remote",
            "endpoint": connection.endpoint,
            "error": str(exc),
        }


@router.post("/counterparty/sync")
async def sync_counterparties_from_onec(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")

    connection = await _get_onec_connection(db, current_user.organization_id)
    if connection:
        try:
            payload = await _onec_get(connection, "/counterparties")
            items = _extract_items(payload, "counterparties")
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Ошибка синхронизации с 1С: {exc}") from exc
    else:
        items = list(MOCK_COUNTERPARTIES.values())

    synced = 0
    created = 0
    updated = 0
    for item in items:
        unp = str(item.get("unp", "")).strip()
        name = str(item.get("name", "")).strip()
        if not unp or not name:
            continue

        result = await db.execute(
            select(Counterparty).where(
                Counterparty.organization_id == current_user.organization_id,
                Counterparty.unp == unp,
            )
        )
        cp = result.scalar_one_or_none()
        if cp:
            cp.name = name
            cp.address = item.get("address")
            cp.bank_account = item.get("account")
            updated += 1
        else:
            db.add(
                Counterparty(
                    organization_id=current_user.organization_id,
                    name=name,
                    unp=unp,
                    address=item.get("address"),
                    bank_account=item.get("account"),
                )
            )
            created += 1
        synced += 1

    await db.flush()
    return {"synced": synced, "created": created, "updated": updated}


@router.post("/accounts/sync")
async def sync_chart_of_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")

    connection = await _get_onec_connection(db, current_user.organization_id)
    if connection:
        try:
            payload = await _onec_get(connection, "/accounts")
            accounts = _extract_items(payload, "accounts")
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Ошибка загрузки плана счетов: {exc}") from exc
    else:
        accounts = CHART_OF_ACCOUNTS

    imported = 0
    for account in accounts:
        code = str(account.get("code", "")).strip()
        name = str(account.get("name", "")).strip()
        if not code or not name:
            continue
        result = await db.execute(
            select(OneCAccount).where(
                OneCAccount.organization_id == current_user.organization_id,
                OneCAccount.code == code,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.name = name
            existing.account_type = account.get("type")
        else:
            db.add(
                OneCAccount(
                    organization_id=current_user.organization_id,
                    code=code,
                    name=name,
                    account_type=account.get("type"),
                )
            )
        imported += 1

    await db.flush()
    return {"imported": imported}


@router.get("/counterparty/lookup")
async def lookup_counterparty(
    unp: str = Query(..., min_length=9, max_length=9),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await _get_onec_connection(db, current_user.organization_id)
    if connection:
        try:
            payload = await _onec_get(connection, f"/counterparties/{unp}")
            if isinstance(payload, dict) and payload.get("found") is False:
                return {"found": False, "unp": unp, "message": "Контрагент не найден в 1С"}
            if isinstance(payload, dict):
                return {"found": True, **payload}
        except httpx.HTTPError:
            pass

    cp = MOCK_COUNTERPARTIES.get(unp)
    if cp:
        return {"found": True, **cp}
    return {"found": False, "unp": unp, "message": "Контрагент не найден в 1С"}


@router.get("/counterparty/search")
async def search_counterparty(
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await _get_onec_connection(db, current_user.organization_id)
    if connection:
        try:
            query = urlencode({"q": q})
            payload = await _onec_get(connection, f"/counterparties/search?{query}")
            items = _extract_items(payload, "results")
            return {"results": items, "total": len(items)}
        except httpx.HTTPError:
            pass

    q_lower = q.lower()
    results = [
        cp for cp in MOCK_COUNTERPARTIES.values()
        if q_lower in cp["name"].lower() or q_lower in cp["unp"]
    ]
    return {"results": results, "total": len(results)}


@router.get("/accounts")
async def get_chart_of_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        return {"accounts": CHART_OF_ACCOUNTS}

    result = await db.execute(
        select(OneCAccount).where(
            OneCAccount.organization_id == current_user.organization_id
        ).order_by(OneCAccount.code)
    )
    accounts = result.scalars().all()
    if accounts:
        return {
            "accounts": [
                {"code": a.code, "name": a.name, "type": a.account_type}
                for a in accounts
            ]
        }
    return {"accounts": CHART_OF_ACCOUNTS}


@router.post("/sync-transaction")
async def sync_transaction_to_1c(
    body: OneCSyncTransactionPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create async sync job for a transaction and trigger worker."""
    tx_id = body.transaction_id

    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.organization_id == current_user.organization_id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "Транзакция не найдена")
    issues = get_transaction_validation_issues(tx)
    if issues:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Транзакция не готова к автодействию",
                "validation_issues": issues,
            },
        )

    job, created = await enqueue_sync_job(
        db=db,
        organization_id=current_user.organization_id,
        transaction_id=tx_id,
        max_attempts=body.max_attempts,
    )
    if not created:
        return {
            "queued": True,
            "job_id": job.id,
            "transaction_id": tx_id,
            "status": job.status,
        }

    return {
        "queued": True,
        "job_id": job.id,
        "transaction_id": tx_id,
        "status": job.status,
    }


@router.get("/sync-jobs")
async def list_sync_jobs(
    status: str | None = Query(None, description="pending|running|retry|success|failed"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [OneCSyncJob.organization_id == current_user.organization_id]
    if status:
        filters.append(OneCSyncJob.status == status)
    result = await db.execute(
        select(OneCSyncJob).where(*filters).order_by(OneCSyncJob.created_at.desc()).limit(100)
    )
    jobs = result.scalars().all()
    return {
        "jobs": [
            {
                "id": job.id,
                "transaction_id": job.transaction_id,
                "status": job.status,
                "attempts": job.attempts,
                "max_attempts": job.max_attempts,
                "last_error": job.last_error,
                "external_id": job.external_id,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            }
            for job in jobs
        ]
    }


@router.post("/sync-jobs/{job_id}/retry")
async def retry_sync_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OneCSyncJob).where(
            OneCSyncJob.id == job_id,
            OneCSyncJob.organization_id == current_user.organization_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Sync job не найден")
    if job.status not in ("failed", "success"):
        raise HTTPException(status_code=409, detail="Retry доступен только для завершённых задач")

    await reset_sync_job_for_retry(db=db, job=job)
    return {
        "queued": True,
        "job_id": job.id,
        "transaction_id": job.transaction_id,
        "status": job.status,
    }


@router.post("/sync-jobs/process")
async def process_sync_jobs_now(
    batch_size: int = Query(20, ge=1, le=200),
    recover_stuck: bool = Query(True),
    current_user: User = Depends(get_current_user),
):
    # current_user is kept for auth/tenant-level access control.
    _ = current_user.id
    recovered = await recover_stuck_sync_jobs(stuck_after_minutes=15) if recover_stuck else 0
    processed = await process_onec_sync_jobs_once(batch_size=batch_size)
    return {
        "processed": processed,
        "recovered_stuck": recovered,
        "batch_size": batch_size,
    }
