import asyncio
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.onec import OneCConnection
from app.models.onec_sync import OneCSyncJob
from app.models.transaction import Transaction


def _build_tx_payload(tx: Transaction) -> dict:
    return {
        "transaction_id": tx.id,
        "type": tx.type,
        "amount": float(tx.amount),
        "vat_amount": float(tx.vat_amount),
        "currency": tx.currency,
        "counterparty_id": tx.counterparty_id,
        "category": tx.category,
        "description": tx.description,
        "transaction_date": tx.transaction_date.isoformat(),
    }


def _extract_external_id(payload: object) -> str:
    if isinstance(payload, dict):
        for field in ("onec_id", "external_id", "id"):
            value = payload.get(field)
            if value:
                return str(value)
    return str(uuid.uuid4())[:8]


async def _onec_post(connection: OneCConnection, path: str, payload: dict, idempotency_key: str) -> object:
    url = urljoin(connection.endpoint.rstrip("/") + "/", path.lstrip("/"))
    headers = {
        "Authorization": f"Bearer {connection.token}",
        "Idempotency-Key": idempotency_key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(url, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()


async def enqueue_sync_job(
    db: AsyncSession,
    organization_id: str,
    transaction_id: str,
    max_attempts: int,
) -> tuple[OneCSyncJob, bool]:
    existing_job_result = await db.execute(
        select(OneCSyncJob).where(
            OneCSyncJob.organization_id == organization_id,
            OneCSyncJob.transaction_id == transaction_id,
            OneCSyncJob.status.in_(["pending", "running", "retry"]),
        )
    )
    existing_job = existing_job_result.scalar_one_or_none()
    if existing_job:
        return existing_job, False

    idempotency_key = f"{organization_id}:{transaction_id}"
    job = OneCSyncJob(
        organization_id=organization_id,
        transaction_id=transaction_id,
        max_attempts=max_attempts,
        idempotency_key=idempotency_key,
        status="pending",
    )
    db.add(job)
    await db.flush()
    return job, True


async def reset_sync_job_for_retry(db: AsyncSession, job: OneCSyncJob) -> None:
    job.status = "pending"
    job.last_error = None
    job.finished_at = None
    job.started_at = None
    job.external_id = None
    job.attempts = 0
    await db.flush()


async def process_onec_sync_jobs_once(batch_size: int = 20) -> int:
    processed = 0
    async with AsyncSessionLocal() as session:
        while processed < batch_size:
            stmt = (
                select(OneCSyncJob)
                .where(OneCSyncJob.status.in_(["pending", "retry"]))
                .order_by(OneCSyncJob.created_at)
                .limit(1)
            )
            # Prevent duplicate picking when multiple API instances run pollers.
            if not settings.DATABASE_URL.startswith("sqlite"):
                stmt = stmt.with_for_update(skip_locked=True)
            job_result = await session.execute(stmt)
            job = job_result.scalar_one_or_none()
            if not job:
                break

            job.status = "running"
            job.started_at = datetime.utcnow()
            job.attempts += 1
            await session.commit()

            tx_result = await session.execute(
                select(Transaction).where(
                    Transaction.id == job.transaction_id,
                    Transaction.organization_id == job.organization_id,
                )
            )
            tx = tx_result.scalar_one_or_none()
            if not tx:
                job.status = "failed"
                job.last_error = "Транзакция не найдена"
                job.finished_at = datetime.utcnow()
                await session.commit()
                processed += 1
                continue

            conn_result = await session.execute(
                select(OneCConnection).where(OneCConnection.organization_id == job.organization_id)
            )
            connection: Optional[OneCConnection] = conn_result.scalar_one_or_none()

            try:
                if connection:
                    remote_payload = await _onec_post(
                        connection=connection,
                        path="/transactions/sync",
                        payload=_build_tx_payload(tx),
                        idempotency_key=job.idempotency_key,
                    )
                    external_id = _extract_external_id(remote_payload)
                else:
                    external_id = str(uuid.uuid4())[:8]

                tx.status = "synced"
                job.status = "success"
                job.external_id = external_id
                job.last_error = None
                job.finished_at = datetime.utcnow()
                await session.commit()
            except Exception as exc:
                job.last_error = str(exc)
                if job.attempts >= job.max_attempts:
                    job.status = "failed"
                    job.finished_at = datetime.utcnow()
                else:
                    job.status = "retry"
                await session.commit()

            processed += 1
    return processed


async def process_onec_sync_jobs_forever() -> None:
    poll_interval = 2 if settings.DEBUG else 5
    batch_size = 20
    while True:
        processed = await process_onec_sync_jobs_once(batch_size=batch_size)
        if processed == 0:
            await asyncio.sleep(poll_interval)
