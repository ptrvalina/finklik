"""Запись событий пилота для анализа трения."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pilot_analytics import PilotUsageEvent


async def track_pilot_event(
    db: AsyncSession,
    *,
    organization_id: str,
    user_id: str | None,
    event_name: str,
    payload: dict | None = None,
) -> None:
    db.add(
        PilotUsageEvent(
            organization_id=organization_id,
            user_id=user_id,
            event_name=event_name[:64],
            payload_json=json.dumps(payload or {}, ensure_ascii=False),
        )
    )
    await db.flush()


async def pilot_friction_summary(db: AsyncSession, organization_id: str, *, days: int = 30) -> dict:
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    rows = await db.execute(
        select(PilotUsageEvent.event_name, func.count())
        .where(
            PilotUsageEvent.organization_id == organization_id,
            PilotUsageEvent.created_at >= since,
        )
        .group_by(PilotUsageEvent.event_name)
    )
    counts = {name: cnt for name, cnt in rows.all()}
    ocr_corrections = counts.get("ocr_field_edited", 0)
    ocr_scans = counts.get("ocr_scan_completed", 0) or 1
    return {
        "days": days,
        "event_counts": counts,
        "ocr_correction_rate": round(ocr_corrections / max(ocr_scans, 1), 3),
        "onboarding_completed": counts.get("onboarding_completed", 0) > 0,
        "work_pack_acks": counts.get("work_pack_ack", 0),
    }
