"""Публичные справочные эндпоинты: официальные курсы НБ РБ."""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.nbrb_fx_service import (
    convert_amount,
    get_snapshot,
    get_snapshot_or_refresh,
)

router = APIRouter(prefix="/fx/nbrb", tags=["fx-nbrb"])


def _http_exc_detail(exc: BaseException) -> str:
    s = str(exc).strip()
    return s if s else f"{type(exc).__name__}"


class NbrbRateOut(BaseModel):
    code: str
    name: str
    scale: int
    official_rate_byn: str
    byn_per_unit: str
    rates_date: str


class NbrbRatesResponse(BaseModel):
    source: str = "National Bank of the Republic of Belarus"
    source_url: str = "https://www.nbrb.by"
    rates_date: str
    fetched_at: str
    stale: bool = False
    refresh_interval_sec: int | None = None
    rates: list[NbrbRateOut]


class NbrbStatusResponse(BaseModel):
    enabled: bool
    background_refresh: bool
    refresh_interval_sec: int | None
    has_data: bool
    fetched_at: str | None
    rates_date: str | None
    currency_count: int | None
    last_error: str | None = None


class ConvertResponse(BaseModel):
    amount: str = Field(description="Исходная сумма")
    from_currency: str
    to_currency: str
    result: str
    rates_date: str
    fetched_at: str
    stale: bool = False


def _stale(snap_fetched_at: datetime) -> bool:
    age = datetime.now(timezone.utc) - snap_fetched_at
    return age.total_seconds() > max(7200, settings.NBRB_FX_REFRESH_SECONDS * 2)


@router.get("/status", response_model=NbrbStatusResponse)
async def nbrb_fx_status():
    snap = get_snapshot()
    return NbrbStatusResponse(
        enabled=settings.NBRB_FX_ENABLED,
        background_refresh=settings.NBRB_FX_ENABLED and settings.NBRB_FX_REFRESH_SECONDS > 0,
        refresh_interval_sec=settings.NBRB_FX_REFRESH_SECONDS if settings.NBRB_FX_REFRESH_SECONDS > 0 else None,
        has_data=snap is not None,
        fetched_at=snap.fetched_at.isoformat() if snap else None,
        rates_date=str(snap.rates_date) if snap else None,
        currency_count=len(snap.currencies) if snap else None,
        last_error=snap.error if snap else None,
    )


@router.get("/rates", response_model=NbrbRatesResponse)
async def nbrb_fx_rates():
    try:
        snap = await get_snapshot_or_refresh()
    except Exception as exc:
        snap = get_snapshot()
        if snap is None:
            raise HTTPException(
                status_code=503,
                detail=f"Не удалось получить курсы НБ РБ: {_http_exc_detail(exc)}",
            ) from exc

    stale = _stale(snap.fetched_at)
    rates = sorted(
        (
            NbrbRateOut(
                code=row.code,
                name=row.name,
                scale=row.scale,
                official_rate_byn=str(row.official_rate_byn),
                byn_per_unit=str(row.byn_per_unit),
                rates_date=str(row.rates_date),
            )
            for row in snap.currencies.values()
        ),
        key=lambda x: x.code,
    )
    return NbrbRatesResponse(
        rates_date=str(snap.rates_date),
        fetched_at=snap.fetched_at.isoformat(),
        stale=stale,
        refresh_interval_sec=settings.NBRB_FX_REFRESH_SECONDS if settings.NBRB_FX_REFRESH_SECONDS > 0 else None,
        rates=rates,
    )


@router.get("/convert", response_model=ConvertResponse)
async def nbrb_fx_convert(
    amount: Decimal = Query(..., gt=0, description="Сумма в валюте «из»"),
    from_currency: str = Query(..., min_length=3, max_length=3, alias="from"),
    to_currency: str = Query(..., min_length=3, max_length=3, alias="to"),
):
    fc = from_currency.strip().upper()
    tc = to_currency.strip().upper()
    if fc == tc:
        raise HTTPException(status_code=400, detail="Валюты «из» и «в» должны различаться")

    try:
        snap = await get_snapshot_or_refresh()
    except Exception as exc:
        snap = get_snapshot()
        if snap is None:
            raise HTTPException(status_code=503, detail=f"Курсы недоступны: {_http_exc_detail(exc)}") from exc

    if fc != "BYN" and fc not in snap.currencies:
        raise HTTPException(status_code=400, detail=f"Неизвестная валюта: {fc}")
    if tc != "BYN" and tc not in snap.currencies:
        raise HTTPException(status_code=400, detail=f"Неизвестная валюта: {tc}")

    try:
        result, _ = convert_amount(amount, fc, tc, snap)
    except (KeyError, InvalidOperation, ZeroDivisionError) as exc:
        raise HTTPException(status_code=400, detail="Не удалось пересчитать сумму") from exc

    return ConvertResponse(
        amount=str(amount),
        from_currency=fc,
        to_currency=tc,
        result=str(result.quantize(Decimal("0.0001"))),
        rates_date=str(snap.rates_date),
        fetched_at=snap.fetched_at.isoformat(),
        stale=_stale(snap.fetched_at),
    )
