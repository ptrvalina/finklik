"""Память контрагентов для OCR и журнала."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now_naive
from app.models.accounting import VendorMemory


def normalize_vendor_name(name: str) -> str:
    s = (name or "").strip().upper()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[«»\"']", "", s)
    return s[:255]


async def remember_vendor(
    db: AsyncSession,
    organization_id: str,
    *,
    display_name: str,
    unp: str | None = None,
    category: str | None = None,
    debit_account: str | None = None,
    credit_account: str | None = None,
) -> VendorMemory:
    norm = normalize_vendor_name(display_name)
    if not norm:
        raise ValueError("empty vendor name")
    result = await db.execute(
        select(VendorMemory).where(
            VendorMemory.organization_id == organization_id,
            VendorMemory.normalized_name == norm,
        )
    )
    row = result.scalar_one_or_none()
    now = utc_now_naive()
    if row:
        row.display_name = display_name.strip()[:255]
        row.scan_count += 1
        row.last_seen_at = now
        if unp:
            row.unp = unp
        if category:
            row.default_category = category
        if debit_account:
            row.default_debit_account = debit_account
        if credit_account:
            row.default_credit_account = credit_account
        await db.flush()
        return row
    row = VendorMemory(
        organization_id=organization_id,
        normalized_name=norm,
        display_name=display_name.strip()[:255],
        unp=unp,
        default_category=category,
        default_debit_account=debit_account,
        default_credit_account=credit_account,
        scan_count=1,
        last_seen_at=now,
    )
    db.add(row)
    await db.flush()
    return row


async def lookup_vendor_hints(
    db: AsyncSession, organization_id: str, display_name: str
) -> dict | None:
    norm = normalize_vendor_name(display_name)
    if not norm:
        return None
    result = await db.execute(
        select(VendorMemory).where(
            VendorMemory.organization_id == organization_id,
            VendorMemory.normalized_name == norm,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    return {
        "display_name": row.display_name,
        "unp": row.unp,
        "default_category": row.default_category,
        "default_debit_account": row.default_debit_account,
        "default_credit_account": row.default_credit_account,
        "scan_count": row.scan_count,
    }
