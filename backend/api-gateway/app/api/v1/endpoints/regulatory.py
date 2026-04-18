"""Regulatory updates monitoring: ФСЗН, ИМНС, Белгосстрах, Белстат.

Until real API integrations are available, this uses a curated set of
mock regulatory updates that reflect typical Belarusian business compliance.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.regulatory import RegulatoryUpdate, RegulatoryNotification

router = APIRouter(prefix="/regulatory", tags=["regulatory"])

AUTHORITIES = {
    "fsszn": "ФСЗН",
    "imns": "ИМНС",
    "belgosstrakh": "Белгосстрах",
    "belstat": "Белстат",
}

MOCK_UPDATES = [
    {
        "authority": "imns",
        "title": "НДС: ставки 0%, 10%, 20%",
        "summary": "Напоминаем: при применении НДС ставка зависит от вида операций (0%, 10% или 20%). "
                   "УСН в продукте учитывается по единой ставке 6%.",
        "category": "rate_change",
        "severity": "critical",
        "effective_date": "2026-01-01T00:00:00",
    },
    {
        "authority": "fsszn",
        "title": "Обновлённая форма ПУ-3",
        "summary": "Утверждена новая форма персонифицированного учёта ПУ-3 (постановление правления ФСЗН от 15.12.2025 №14). "
                   "Новая форма обязательна к применению с отчёта за I квартал 2026 года.",
        "category": "form_update",
        "severity": "warning",
        "effective_date": "2026-04-01T00:00:00",
    },
    {
        "authority": "imns",
        "title": "Сроки сдачи декларации по НДС за I квартал 2026",
        "summary": "Напоминаем: декларация по НДС за I квартал 2026 года подаётся не позднее 20 апреля 2026 года. "
                   "Уплата — не позднее 22 апреля 2026 года.",
        "category": "deadline_change",
        "severity": "warning",
        "effective_date": "2026-04-20T00:00:00",
    },
    {
        "authority": "belgosstrakh",
        "title": "Новые тарифы страхования от несчастных случаев",
        "summary": "С 01.04.2026 обновлены страховые тарифы по обязательному страхованию от несчастных случаев "
                   "на производстве. Тариф для офисных работников — 0,1%, для производственных — 0,6%.",
        "category": "rate_change",
        "severity": "info",
        "effective_date": "2026-04-01T00:00:00",
    },
    {
        "authority": "belstat",
        "title": "Форма 12-т (краткая): новые сроки",
        "summary": "Форма государственной статистической отчётности 12-т (краткая) «Отчёт по труду» "
                   "за I квартал 2026 года подаётся не позднее 12 апреля 2026 года.",
        "category": "deadline_change",
        "severity": "info",
        "effective_date": "2026-04-12T00:00:00",
    },
    {
        "authority": "fsszn",
        "title": "Повышение минимальной заработной платы",
        "summary": "С 01.01.2026 минимальная заработная плата установлена в размере 626 BYN. "
                   "Наниматели обязаны привести оклады в соответствие.",
        "category": "law_change",
        "severity": "critical",
        "effective_date": "2026-01-01T00:00:00",
    },
    {
        "authority": "imns",
        "title": "Электронные счета-фактуры: обновление формата",
        "summary": "С 01.07.2026 вводится обновлённый формат электронных счетов-фактур (ЭСЧФ). "
                   "Все плательщики НДС обязаны перейти на новый формат.",
        "category": "form_update",
        "severity": "warning",
        "effective_date": "2026-07-01T00:00:00",
    },
    {
        "authority": "belgosstrakh",
        "title": "Отчёт по страхованию: новая форма",
        "summary": "Утверждена обновлённая форма отчётности по обязательному страхованию "
                   "от несчастных случаев на производстве и профессиональных заболеваний.",
        "category": "form_update",
        "severity": "info",
        "effective_date": "2026-07-01T00:00:00",
    },
]


@router.get("/updates")
async def list_updates(
    authority: str | None = Query(None, description="Filter by authority"),
    category: str | None = Query(None),
    severity: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get regulatory updates, seeding mock data on first call."""
    count_result = await db.execute(select(func.count(RegulatoryUpdate.id)))
    total = count_result.scalar() or 0

    if total == 0:
        for upd in MOCK_UPDATES:
            ru = RegulatoryUpdate(
                authority=upd["authority"],
                title=upd["title"],
                summary=upd["summary"],
                category=upd["category"],
                severity=upd["severity"],
                effective_date=datetime.fromisoformat(upd["effective_date"]) if upd.get("effective_date") else None,
            )
            db.add(ru)
        await db.flush()

    query = select(RegulatoryUpdate).where(RegulatoryUpdate.is_active == True)
    if authority:
        query = query.where(RegulatoryUpdate.authority == authority)
    if category:
        query = query.where(RegulatoryUpdate.category == category)
    if severity:
        query = query.where(RegulatoryUpdate.severity == severity)
    query = query.order_by(desc(RegulatoryUpdate.created_at))

    result = await db.execute(query)
    updates = result.scalars().all()

    read_result = await db.execute(
        select(RegulatoryNotification.update_id).where(
            RegulatoryNotification.organization_id == current_user.organization_id,
            RegulatoryNotification.is_read == True,
        )
    )
    read_ids = set(row for row in read_result.scalars().all())

    return {
        "updates": [
            {
                "id": u.id,
                "authority": u.authority,
                "authority_name": AUTHORITIES.get(u.authority, u.authority),
                "title": u.title,
                "summary": u.summary,
                "category": u.category,
                "severity": u.severity,
                "effective_date": u.effective_date.isoformat() if u.effective_date else None,
                "source_url": u.source_url,
                "is_read": u.id in read_ids,
                "created_at": u.created_at.isoformat(),
            }
            for u in updates
        ],
        "unread_count": sum(1 for u in updates if u.id not in read_ids),
    }


@router.post("/updates/{update_id}/read")
async def mark_as_read(
    update_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a regulatory update as read for the current organization."""
    existing = await db.execute(
        select(RegulatoryNotification).where(
            RegulatoryNotification.update_id == update_id,
            RegulatoryNotification.organization_id == current_user.organization_id,
        )
    )
    notif = existing.scalar_one_or_none()
    if notif:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
    else:
        notif = RegulatoryNotification(
            update_id=update_id,
            organization_id=current_user.organization_id,
            is_read=True,
            read_at=datetime.now(timezone.utc),
        )
        db.add(notif)
    await db.flush()
    return {"ok": True}


@router.post("/updates/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all updates as read."""
    result = await db.execute(
        select(RegulatoryUpdate.id).where(RegulatoryUpdate.is_active == True)
    )
    all_ids = result.scalars().all()

    read_result = await db.execute(
        select(RegulatoryNotification.update_id).where(
            RegulatoryNotification.organization_id == current_user.organization_id,
        )
    )
    existing_ids = set(read_result.scalars().all())

    for uid in all_ids:
        if uid not in existing_ids:
            db.add(RegulatoryNotification(
                update_id=uid,
                organization_id=current_user.organization_id,
                is_read=True,
                read_at=datetime.now(timezone.utc),
            ))

    await db.flush()
    return {"ok": True, "marked": len(all_ids)}


@router.get("/authorities")
async def list_authorities():
    """List supported regulatory authorities."""
    return {
        "authorities": [
            {"code": code, "name": name}
            for code, name in AUTHORITIES.items()
        ]
    }
