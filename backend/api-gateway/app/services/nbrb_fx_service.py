"""
Официальные курсы валют НБ РБ (источник: https://www.nbrb.by/apihelp/exrates).

Кэш в памяти процесса + фоновое обновление. При недоступности API отдаём последний успешный снимок (stale=true).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger()

NBRB_RATES_URL = "https://www.nbrb.by/api/exrates/rates?periodicity=0"
# periodicity=0 — курс на выбранный день (текущие установленные)

_snapshot_lock = asyncio.Lock()
_snapshot: "NbrbRatesSnapshot | None" = None
_refresh_task: asyncio.Task[None] | None = None


@dataclass(frozen=True)
class NbrbCurrencyRow:
    cur_id: int
    code: str
    scale: int
    name: str
    """Официальный курс: столько BYN за `scale` единиц валюты."""
    official_rate_byn: Decimal
    rates_date: date

    @property
    def byn_per_unit(self) -> Decimal:
        return self.official_rate_byn / Decimal(self.scale)


@dataclass(frozen=True)
class NbrbRatesSnapshot:
    fetched_at: datetime
    rates_date: date
    currencies: dict[str, NbrbCurrencyRow]
    source: str = "nbrb.by"
    error: str | None = None


def _parse_row(raw: dict[str, Any]) -> NbrbCurrencyRow:
    code = str(raw["Cur_Abbreviation"]).strip().upper()
    scale = int(raw["Cur_Scale"])
    rate = Decimal(str(raw["Cur_OfficialRate"]))
    d = raw.get("Date")
    if isinstance(d, str):
        rates_date = date.fromisoformat(d[:10])
    else:
        rates_date = date.today()
    return NbrbCurrencyRow(
        cur_id=int(raw["Cur_ID"]),
        code=code,
        scale=scale,
        name=str(raw.get("Cur_Name", code)),
        official_rate_byn=rate,
        rates_date=rates_date,
    )


async def fetch_nbrb_rates() -> NbrbRatesSnapshot:
    """HTTP-запрос к API НБ РБ и сбор снимка."""
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        r = await client.get(NBRB_RATES_URL)
        r.raise_for_status()
        data = r.json()
    if not isinstance(data, list):
        raise ValueError("unexpected_nbrb_payload")

    currencies: dict[str, NbrbCurrencyRow] = {}
    rates_date = date.today()
    for item in data:
        if not isinstance(item, dict):
            continue
        row = _parse_row(item)
        currencies[row.code] = row
        rates_date = row.rates_date

    now = datetime.now(timezone.utc)
    return NbrbRatesSnapshot(
        fetched_at=now,
        rates_date=rates_date,
        currencies=currencies,
        error=None,
    )


async def refresh_rates() -> NbrbRatesSnapshot:
    """Обновить кэш (один HTTP-запрос под lock)."""
    global _snapshot
    async with _snapshot_lock:
        snap = await fetch_nbrb_rates()
        _snapshot = snap
    log.info(
        "nbrb_rates_refreshed",
        rates_date=str(snap.rates_date),
        count=len(snap.currencies),
    )
    return snap


def get_snapshot() -> NbrbRatesSnapshot | None:
    return _snapshot


async def get_snapshot_or_refresh() -> NbrbRatesSnapshot:
    """Вернуть снимок; если пусто — загрузить с НБ РБ."""
    async with _snapshot_lock:
        if _snapshot is not None:
            return _snapshot
    try:
        return await refresh_rates()
    except Exception as exc:
        log.warning("nbrb_rates_fetch_failed", error=str(exc) or repr(exc), exc_type=type(exc).__name__)
        async with _snapshot_lock:
            if _snapshot is not None:
                return _snapshot
        raise


def convert_amount(
    amount: Decimal,
    from_code: str,
    to_code: str,
    snap: NbrbRatesSnapshot,
) -> tuple[Decimal, dict[str, Any]]:
    """
    Пересчёт через BYN: amount * rate(from→BYN) / rate(to→BYN).
    BYN поддерживается как база (код BYN).
    """
    fc = from_code.strip().upper()
    tc = to_code.strip().upper()
    meta: dict[str, Any] = {"from": fc, "to": tc}

    if fc == tc:
        return amount, meta

    def to_byn(code: str, amt: Decimal) -> Decimal:
        if code == "BYN":
            return amt
        row = snap.currencies.get(code)
        if not row:
            raise KeyError(code)
        # amt единиц валюты code → BYN
        return amt * row.byn_per_unit

    def from_byn(code: str, amt_byn: Decimal) -> Decimal:
        if code == "BYN":
            return amt_byn
        row = snap.currencies.get(code)
        if not row:
            raise KeyError(code)
        return amt_byn / row.byn_per_unit

    byn_amt = to_byn(fc, amount)
    meta["amount_byn_intermediate"] = str(byn_amt)
    result = from_byn(tc, byn_amt)
    return result, meta


async def nbrb_fx_background_loop() -> None:
    """Периодическое обновление курсов."""
    interval = max(60, int(settings.NBRB_FX_REFRESH_SECONDS or 3600))
    while True:
        try:
            await refresh_rates()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("nbrb_background_refresh_failed", error=str(exc))
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise


def start_nbrb_background_loop() -> asyncio.Task[None] | None:
    global _refresh_task
    if not settings.NBRB_FX_ENABLED or settings.NBRB_FX_REFRESH_SECONDS <= 0:
        return None
    _refresh_task = asyncio.create_task(nbrb_fx_background_loop(), name="nbrb_fx_refresh")
    return _refresh_task


async def stop_nbrb_background_loop() -> None:
    global _refresh_task
    if _refresh_task:
        _refresh_task.cancel()
        try:
            await _refresh_task
        except asyncio.CancelledError:
            pass
        _refresh_task = None
