"""Sprint 10: production tax calculator details."""

from pathlib import Path
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import Organization


@pytest.mark.asyncio
async def test_tax_calculation_returns_breakdown_and_deadlines(client: AsyncClient, auth_headers: dict):
    income = await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "amount": 1000,
            "currency": "BYN",
            "transaction_date": "2026-04-10",
            "description": "Выручка",
        },
        headers=auth_headers,
    )
    assert income.status_code == 201

    expense = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": 300,
            "currency": "BYN",
            "transaction_date": "2026-04-12",
            "description": "Расход",
        },
        headers=auth_headers,
    )
    assert expense.status_code == 201

    r = await client.get(
        "/api/v1/tax/calculate",
        params={"period_start": "2026-04-01", "period_end": "2026-04-30", "with_vat": "true"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["tax_regime"] in ("usn_3", "usn_5")
    assert isinstance(data.get("assumptions"), list) and len(data["assumptions"]) >= 1
    assert isinstance(data.get("breakdown"), list) and len(data["breakdown"]) >= 1
    assert data.get("fsszn_deadline")
    assert data.get("regulatory_version")
    assert data.get("regulatory_year") in (2024, 2025, 2026)
    # If VAT is included by effective regime/flag, VAT deadline should be present.
    if data.get("vat_to_pay", 0) >= 0:
        assert "vat_deadline" in data


@pytest.mark.asyncio
async def test_tax_calculation_respects_org_regime_and_warns(client: AsyncClient, auth_headers: dict, db_session):
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.status_code == 200
    org_id = me.json()["organization_id"]

    org_r = await db_session.execute(select(Organization).where(Organization.id == org_id))
    org = org_r.scalar_one()
    org.tax_regime = "usn_no_vat"
    await db_session.flush()

    r = await client.get(
        "/api/v1/tax/calculate",
        params={"period_start": "2026-04-01", "period_end": "2026-04-30", "with_vat": "true"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["tax_regime"] == "usn_5"
    assert data["vat_to_pay"] == 0
    assumptions = data.get("assumptions") or []
    assert any("проигнорирован" in str(a) for a in assumptions)
    assert data.get("regulatory_version")


@pytest.mark.asyncio
async def test_validate_tax_rules_endpoint_for_owner(client: AsyncClient, auth_headers: dict):
    r = await client.get("/api/v1/tax/rules/validate", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "ok" in data
    assert "source" in data
    assert "using_fallback" in data
    assert isinstance(data.get("years"), list)


@pytest.mark.asyncio
async def test_validate_tax_rules_fallback_on_invalid_config(client: AsyncClient, auth_headers: dict):
    from app.services import tax_calculator as tax_calc_module

    config_path = Path(tax_calc_module.__file__).resolve().parent.parent / "config" / "tax_rules.json"
    had_config = config_path.is_file()
    backup = config_path.read_text(encoding="utf-8") if had_config else None
    try:
        config_path.write_text('{"years": ', encoding="utf-8")

        r = await client.get("/api/v1/tax/rules/validate", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["using_fallback"] is True
        assert data["ok"] is False
        assert isinstance(data.get("errors"), list) and len(data["errors"]) >= 1
        assert isinstance(data.get("years"), list) and len(data["years"]) >= 1

        metrics = await client.get("/metrics")
        assert metrics.status_code == 200
        assert "tax_rules_validate_fallback_total" in metrics.text
    finally:
        if had_config and backup is not None:
            config_path.write_text(backup, encoding="utf-8")
        elif config_path.exists():
            config_path.unlink()
