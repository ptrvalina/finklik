"""Логика конвертации и разбора снимка НБ РБ без HTTP."""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.services.nbrb_fx_service import (
    NbrbCurrencyRow,
    NbrbRatesSnapshot,
    convert_amount,
    _parse_row,
)


def test_parse_row_usd():
    raw = {
        "Cur_ID": 431,
        "Date": "2026-04-17T00:00:00",
        "Cur_Abbreviation": "USD",
        "Cur_Scale": 1,
        "Cur_Name": "US Dollar",
        "Cur_OfficialRate": 3.1025,
    }
    row = _parse_row(raw)
    assert row.code == "USD"
    assert row.scale == 1
    assert row.byn_per_unit == Decimal("3.1025")


def test_parse_row_scale_100():
    raw = {
        "Cur_ID": 456,
        "Date": "2026-04-17T00:00:00",
        "Cur_Abbreviation": "JPY",
        "Cur_Scale": 100,
        "Cur_Name": "Yen",
        "Cur_OfficialRate": 2.05,
    }
    row = _parse_row(raw)
    assert row.byn_per_unit == Decimal("2.05") / Decimal(100)


def test_convert_usd_to_byn():
    snap = NbrbRatesSnapshot(
        fetched_at=datetime.now(timezone.utc),
        rates_date=date(2026, 4, 17),
        currencies={
            "USD": NbrbCurrencyRow(
                cur_id=431,
                code="USD",
                scale=1,
                name="USD",
                official_rate_byn=Decimal("3"),
                rates_date=date(2026, 4, 17),
            )
        },
    )
    out, _ = convert_amount(Decimal("10"), "USD", "BYN", snap)
    assert out == Decimal("30")


def test_convert_byn_to_usd():
    snap = NbrbRatesSnapshot(
        fetched_at=datetime.now(timezone.utc),
        rates_date=date(2026, 4, 17),
        currencies={
            "USD": NbrbCurrencyRow(
                cur_id=431,
                code="USD",
                scale=1,
                name="USD",
                official_rate_byn=Decimal("3"),
                rates_date=date(2026, 4, 17),
            )
        },
    )
    out, _ = convert_amount(Decimal("30"), "BYN", "USD", snap)
    assert out == Decimal("10")


def test_convert_cross():
    snap = NbrbRatesSnapshot(
        fetched_at=datetime.now(timezone.utc),
        rates_date=date(2026, 4, 17),
        currencies={
            "USD": NbrbCurrencyRow(
                cur_id=431,
                code="USD",
                scale=1,
                name="USD",
                official_rate_byn=Decimal("3.20"),
                rates_date=date(2026, 4, 17),
            ),
            "EUR": NbrbCurrencyRow(
                cur_id=451,
                code="EUR",
                scale=1,
                name="EUR",
                official_rate_byn=Decimal("3.50"),
                rates_date=date(2026, 4, 17),
            ),
        },
    )
    # 100 USD -> 320 BYN -> EUR: 320/3.5
    out, _ = convert_amount(Decimal("100"), "USD", "EUR", snap)
    expected = (Decimal("100") * Decimal("3.20")) / Decimal("3.50")
    assert out == expected
