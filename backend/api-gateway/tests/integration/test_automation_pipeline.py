import pytest
from httpx import AsyncClient


def _stub_submission_settings(**kw):
    payload = {
        "DEBUG": True,
        "MOCK_SUBMISSION_REJECT_RATE": 0.0,
        "SUBMISSION_PORTAL_MODE": "mock",
        "SUBMISSION_PORTAL_BASE_URL": "",
        "SUBMISSION_PORTAL_HTTP_TIMEOUT_SEC": 30.0,
        "SUBMISSION_PORTAL_HTTP_RETRIES": 2,
    }
    payload.update(kw)
    return type("S", (), payload)()


@pytest.mark.asyncio
async def test_auto_categorization_rule_applied(client: AsyncClient, auth_headers: dict):
    rule_resp = await client.post(
        "/api/v1/categorization-rules",
        json={
            "name": "Комиссии банка",
            "category": "services",
            "transaction_type": "expense",
            "description_pattern": "комиссия",
            "priority": 10,
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert rule_resp.status_code == 201, rule_resp.text

    tx_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": 55.0,
            "description": "Комиссия банка за обслуживание",
            "transaction_date": "2026-04-10",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201, tx_resp.text
    data = tx_resp.json()
    assert data["category"] == "services"
    assert data["pipeline_status"] in ("categorized", "verified", "reported")


@pytest.mark.asyncio
async def test_submission_confirm_blocked_on_inconsistent_data(client: AsyncClient, auth_headers: dict):
    tx_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": 120.0,
            "description": "",
            "transaction_date": "2026-04-11",
        },
        headers=auth_headers,
    )
    assert tx_resp.status_code == 201, tx_resp.text

    sub_resp = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "usn-declaration",
            "report_period": "2026-Q2",
        },
        headers=auth_headers,
    )
    assert sub_resp.status_code == 200, sub_resp.text
    sub_id = sub_resp.json()["id"]

    confirm_resp = await client.post(f"/api/v1/submissions/{sub_id}/confirm", headers=auth_headers)
    assert confirm_resp.status_code == 409
    assert "несоглас" in confirm_resp.text.lower()


@pytest.mark.asyncio
async def test_automation_policy_and_kpi_endpoints(client: AsyncClient, auth_headers: dict):
    policy_get = await client.get("/api/v1/automation/policy", headers=auth_headers)
    assert policy_get.status_code == 200
    assert policy_get.json()["mode"] in ("assist", "checkpoints", "autopilot")

    policy_put = await client.put(
        "/api/v1/automation/policy",
        json={
            "mode": "checkpoints",
            "allow_auto_reporting": True,
            "allow_auto_workforce": True,
            "max_auto_submissions_per_run": 15,
        },
        headers=auth_headers,
    )
    assert policy_put.status_code == 200
    assert policy_put.json()["mode"] == "checkpoints"

    kpi_resp = await client.get("/api/v1/automation/kpi", headers=auth_headers)
    assert kpi_resp.status_code == 200
    kpi = kpi_resp.json()
    assert "operations_auto_rate" in kpi
    assert "pipeline_pass_rate" in kpi
    assert "auto_categorized_share" in kpi
    assert "cycle_reduction_progress_x" in kpi
    assert "obligations_auto_created_rate" in kpi
    assert "scheduled_scenarios_count" in kpi
    assert "auto_job_success_rate" in kpi
    assert "recurring_incidents_rate" in kpi
    assert "targets" in kpi

    dq_resp = await client.get("/api/v1/automation/data-quality", headers=auth_headers)
    assert dq_resp.status_code == 200
    dq = dq_resp.json()
    assert "duplicate_operations" in dq
    assert "inconsistent_operations" in dq


@pytest.mark.asyncio
async def test_e2e_operation_to_auto_submit_flow(client: AsyncClient, auth_headers: dict, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.report_submission.get_settings",
        lambda: _stub_submission_settings(DEBUG=True, MOCK_SUBMISSION_REJECT_RATE=0.0),
    )

    rule_resp = await client.post(
        "/api/v1/categorization-rules",
        json={
            "name": "Аренда офиса",
            "category": "rent",
            "transaction_type": "expense",
            "description_pattern": "аренда",
            "priority": 20,
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert rule_resp.status_code == 201, rule_resp.text

    income_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "amount": 5000.0,
            "description": "Оплата по договору",
            "transaction_date": "2026-04-12",
        },
        headers=auth_headers,
    )
    assert income_resp.status_code == 201, income_resp.text

    expense_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": 1200.0,
            "description": "Аренда офиса за апрель",
            "transaction_date": "2026-04-13",
        },
        headers=auth_headers,
    )
    assert expense_resp.status_code == 201, expense_resp.text
    expense_data = expense_resp.json()
    assert expense_data["category"] == "rent"
    assert expense_data["pipeline_status"] in ("verified", "reported")

    sub_resp = await client.post(
        "/api/v1/submissions",
        json={
            "authority": "imns",
            "report_type": "usn-declaration",
            "report_period": "2026-Q2",
        },
        headers=auth_headers,
    )
    assert sub_resp.status_code == 200, sub_resp.text
    sub_id = sub_resp.json()["id"]

    readiness_resp = await client.get(f"/api/v1/submissions/{sub_id}/readiness", headers=auth_headers)
    assert readiness_resp.status_code == 200, readiness_resp.text
    readiness = readiness_resp.json()
    assert readiness["ready"] is True
    assert readiness["issues"] == []

    confirm_resp = await client.post(f"/api/v1/submissions/{sub_id}/confirm", headers=auth_headers)
    assert confirm_resp.status_code == 200, confirm_resp.text
    assert confirm_resp.json()["status"] == "confirmed"

    auto_submit_resp = await client.post("/api/v1/submissions/auto-submit?limit=20", headers=auth_headers)
    assert auto_submit_resp.status_code == 200, auto_submit_resp.text
    auto_payload = auto_submit_resp.json()
    assert auto_payload["processed"] >= 1
    assert auto_payload["submitted"] >= 1
    assert auto_payload["skipped"] == 0

    final_resp = await client.get(f"/api/v1/submissions/{sub_id}", headers=auth_headers)
    assert final_resp.status_code == 200, final_resp.text
    final_payload = final_resp.json()
    assert final_payload["status"] == "accepted"
    assert final_payload["submission_ref"]


@pytest.mark.asyncio
async def test_monthly_payroll_run_endpoint(client: AsyncClient, auth_headers: dict):
    run_resp = await client.post(
        "/api/v1/salary/run-month",
        json={"period_year": 2026, "period_month": 4, "work_days_plan": 21},
        headers=auth_headers,
    )
    assert run_resp.status_code == 200, run_resp.text
    payload = run_resp.json()
    assert payload["period_year"] == 2026
    assert payload["period_month"] == 4
    assert "employees_total" in payload
