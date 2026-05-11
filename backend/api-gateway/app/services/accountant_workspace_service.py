"""Агрегация операционного «командного центра» бухгалтера по всем доступным организациям."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import ApprovalRequest, OperationalInboxItem
from app.models.user import Organization, UserOrganizationMembership
from app.services.reporting_calm_service import build_reporting_calm_overview


async def build_accountant_workspace_summary(db: AsyncSession, user_id: str) -> dict:
    """Карточки клиентов: готовность, inbox, согласования — без CRM-перегруза."""
    r = await db.execute(
        select(UserOrganizationMembership, Organization)
        .join(Organization, Organization.id == UserOrganizationMembership.organization_id)
        .where(UserOrganizationMembership.user_id == user_id)
        .order_by(UserOrganizationMembership.is_pinned.desc(), Organization.name.asc())
    )
    pairs = list(r.all())
    if not pairs:
        return {"organizations": [], "generated_at": datetime.now(timezone.utc).isoformat()}

    async def card(mem: UserOrganizationMembership, org: Organization) -> dict:
        overview = await build_reporting_calm_overview(db, org.id)
        inbox_n = await db.execute(
            select(func.count(OperationalInboxItem.id)).where(
                OperationalInboxItem.organization_id == org.id,
                OperationalInboxItem.status == "open",
            )
        )
        appr_n = await db.execute(
            select(func.count(ApprovalRequest.id)).where(
                ApprovalRequest.organization_id == org.id,
                ApprovalRequest.status == "pending",
            )
        )
        attention = sum(
            1 for x in overview.consistency_issues if (x.severity or "") in ("attention", "risk")
        )
        return {
            "organization_id": org.id,
            "organization_name": org.name,
            "unp": org.unp,
            "is_pinned": mem.is_pinned,
            "readiness_score": overview.readiness.score,
            "readiness_confidence": overview.readiness.confidence,
            "open_inbox": int(inbox_n.scalar() or 0),
            "pending_approvals": int(appr_n.scalar() or 0),
            "attention_issues": attention,
            "ai_summary": overview.ai_summary,
        }

    rows = await asyncio.gather(*[card(m, o) for m, o in pairs])
    return {"organizations": list(rows), "generated_at": datetime.now(timezone.utc).isoformat()}
