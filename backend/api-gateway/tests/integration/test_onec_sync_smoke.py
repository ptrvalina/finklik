"""Smoke tests for 1C sync queue pipeline."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.onec_sync import OneCSyncJob
from app.services.onec_sync_service import process_onec_sync_jobs_once


@pytest.mark.asyncio
async def test_onec_sync_queue_worker_smoke(
    client: AsyncClient, auth_headers: dict, onec_worker_uses_test_db
):
    tx_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "amount": 333.33,
            "vat_amount": 55.55,
            "currency": "BYN",
            "category": "sales",
            "description": "Smoke sync job",
            "transaction_date": "2026-04-14",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201
    tx_id = tx_resp.json()["id"]

    queue_resp = await client.post(
        "/api/v1/onec/sync-transaction",
        json={"transaction_id": tx_id, "max_attempts": 2},
        headers=auth_headers,
    )
    assert queue_resp.status_code == 200
    assert queue_resp.json()["queued"] is True

    processed = await process_onec_sync_jobs_once(batch_size=5)
    assert processed >= 1

    jobs_resp = await client.get("/api/v1/onec/sync-jobs", headers=auth_headers)
    assert jobs_resp.status_code == 200
    jobs = jobs_resp.json()["jobs"]
    job = next((j for j in jobs if j["transaction_id"] == tx_id), None)
    assert job is not None
    assert job["status"] == "success"
    assert job["external_id"]


@pytest.mark.asyncio
async def test_onec_process_endpoint_recovers_stuck_job(
    client: AsyncClient,
    auth_headers: dict,
    onec_worker_uses_test_db,
    db_session,
):
    tx_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "amount": 120.0,
            "currency": "BYN",
            "category": "sales",
            "description": "stuck recovery case",
            "transaction_date": "2026-04-14",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201
    tx_id = tx_resp.json()["id"]

    queue_resp = await client.post(
        "/api/v1/onec/sync-transaction",
        json={"transaction_id": tx_id, "max_attempts": 3},
        headers=auth_headers,
    )
    assert queue_resp.status_code == 200
    job_id = queue_resp.json()["job_id"]

    result = await db_session.execute(select(OneCSyncJob).where(OneCSyncJob.id == job_id))
    job = result.scalar_one()
    job.status = "running"
    job.started_at = datetime.now(timezone.utc) - timedelta(minutes=45)
    job.attempts = 1
    await db_session.commit()

    process_resp = await client.post(
        "/api/v1/onec/sync-jobs/process?batch_size=10&recover_stuck=true",
        headers=auth_headers,
    )
    assert process_resp.status_code == 200
    payload = process_resp.json()
    assert payload["recovered_stuck"] >= 1
    assert payload["processed"] >= 1

    jobs_resp = await client.get("/api/v1/onec/sync-jobs", headers=auth_headers)
    assert jobs_resp.status_code == 200
    jobs = jobs_resp.json()["jobs"]
    recovered = next((j for j in jobs if j["id"] == job_id), None)
    assert recovered is not None
    assert recovered["status"] == "success"
