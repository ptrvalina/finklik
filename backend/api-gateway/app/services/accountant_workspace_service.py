"""Агрегация операционного «командного центра» бухгалтера по всем доступным организациям."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now_naive
from app.models.collaboration import ApprovalRequest, OperationalInboxItem
from app.models.user import Organization, UserOrganizationMembership
from app.schemas.reporting_calm import ReportingCalmOverview
from app.services.reporting_calm_service import build_reporting_calm_overview


def _next_deadline_from_overview(
    overview: ReportingCalmOverview,
    *,
    inbox_due_at: datetime | None,
    inbox_title: str | None,
    today: date,
) -> dict | None:
    """Ближайший срок: календарь/обязательства из calm timeline или due_at входящего."""
    candidates: list[tuple[date, str, str, str]] = []

    for item in overview.timeline:
        if item.state == "submitted":
            continue
        candidates.append((item.date, item.title, item.kind, item.state))

    if inbox_due_at is not None:
        d = inbox_due_at.date() if hasattr(inbox_due_at, "date") else inbox_due_at
        candidates.append((d, inbox_title or "Входящее с дедлайном", "inbox", "needs_attention"))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])
    d, title, kind, state = candidates[0]
    return {
        "date": d.isoformat(),
        "title": title,
        "kind": kind,
        "state": state,
        "days_until": (d - today).days,
    }


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

    today = utc_now_naive().date()

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
        inbox_due_r = await db.execute(
            select(OperationalInboxItem.due_at, OperationalInboxItem.title)
            .where(
                and_(
                    OperationalInboxItem.organization_id == org.id,
                    OperationalInboxItem.status == "open",
                    OperationalInboxItem.due_at.isnot(None),
                )
            )
            .order_by(OperationalInboxItem.due_at.asc())
            .limit(1)
        )
        inbox_due_row = inbox_due_r.first()
        inbox_due_at = inbox_due_row[0] if inbox_due_row else None
        inbox_due_title = inbox_due_row[1] if inbox_due_row else None

        attention = sum(
            1 for x in overview.consistency_issues if (x.severity or "") in ("attention", "risk")
        )
        doc = overview.financial_state.document_completeness if overview.financial_state else None
        pending_ocr = int(doc.pending_ocr) if doc else 0
        needs_review = int(doc.needs_review) if doc else 0
        next_deadline = _next_deadline_from_overview(
            overview,
            inbox_due_at=inbox_due_at,
            inbox_title=inbox_due_title,
            today=today,
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
            "pending_ocr": pending_ocr,
            "needs_review": needs_review,
            "next_deadline": next_deadline,
            "ai_summary": overview.ai_summary,
        }

    rows = await asyncio.gather(*[card(m, o) for m, o in pairs])

    def _sort_key(card: dict) -> tuple:
        # Закреплённые сверху; затем ниже готовность и выше операционная нагрузка — «нужно внимание» выше в списке.
        pinned = 0 if card.get("is_pinned") else 1
        rs = card.get("readiness_score")
        try:
            score_key = float(rs) if rs is not None else 999.0
        except (TypeError, ValueError):
            score_key = 999.0
        workload = (
            int(card.get("open_inbox") or 0)
            + int(card.get("pending_approvals") or 0)
            + int(card.get("attention_issues") or 0)
            + int(card.get("needs_review") or 0)
            + int(card.get("pending_ocr") or 0)
        )
        nd = card.get("next_deadline") or {}
        try:
            deadline_key = nd.get("date") or "9999-12-31"
        except (TypeError, AttributeError):
            deadline_key = "9999-12-31"
        name = str(card.get("organization_name") or "")
        return (pinned, score_key, -workload, deadline_key, name)

    ordered = sorted(rows, key=_sort_key)

    deadlines: list[dict] = []
    for card in ordered:
        nd = card.get("next_deadline")
        if not nd:
            continue
        deadlines.append(
            {
                "organization_id": card["organization_id"],
                "organization_name": card["organization_name"],
                **nd,
            }
        )
    deadlines.sort(key=lambda x: (x.get("date") or "9999-12-31", x.get("organization_name") or ""))

    totals = {
        "open_inbox": sum(int(c.get("open_inbox") or 0) for c in ordered),
        "pending_approvals": sum(int(c.get("pending_approvals") or 0) for c in ordered),
        "attention_issues": sum(int(c.get("attention_issues") or 0) for c in ordered),
        "needs_review": sum(int(c.get("needs_review") or 0) for c in ordered),
        "pending_ocr": sum(int(c.get("pending_ocr") or 0) for c in ordered),
    }

    return {
        "organizations": ordered,
        "deadlines": deadlines[:20],
        "totals": totals,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


_PRIORITY_RANK = {"urgent": 0, "high": 1, "normal": 2, "low": 3}


async def build_accountant_global_queues(db: AsyncSession, user_id: str, *, limit: int = 80) -> dict:
    """Сводные входящие и согласования по всем клиентам бухгалтера (без N переключений org)."""
    r = await db.execute(
        select(UserOrganizationMembership.organization_id, Organization.name)
        .join(Organization, Organization.id == UserOrganizationMembership.organization_id)
        .where(UserOrganizationMembership.user_id == user_id)
    )
    org_map = {row[0]: row[1] for row in r.all()}
    if not org_map:
        return {
            "inbox": [],
            "approvals": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    org_ids = list(org_map.keys())
    inbox_r = await db.execute(
        select(OperationalInboxItem)
        .where(
            OperationalInboxItem.organization_id.in_(org_ids),
            OperationalInboxItem.status == "open",
        )
        .order_by(OperationalInboxItem.created_at.desc())
        .limit(limit)
    )
    appr_r = await db.execute(
        select(ApprovalRequest)
        .where(
            ApprovalRequest.organization_id.in_(org_ids),
            ApprovalRequest.status == "pending",
        )
        .order_by(ApprovalRequest.created_at.desc())
        .limit(limit)
    )

    inbox_rows = list(inbox_r.scalars().all())
    _far_future = datetime(9999, 12, 31)

    inbox_rows.sort(
        key=lambda i: (
            _PRIORITY_RANK.get((i.priority or "normal").lower(), 9),
            i.due_at or _far_future,
        ),
    )

    inbox = [
        {
            "id": i.id,
            "organization_id": i.organization_id,
            "organization_name": org_map.get(i.organization_id, ""),
            "kind": i.kind,
            "title": i.title,
            "body": i.body,
            "priority": i.priority,
            "linked_transaction_id": i.linked_transaction_id,
            "linked_document_id": i.linked_document_id,
            "due_at": i.due_at.isoformat() if i.due_at else None,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in inbox_rows[:limit]
    ]
    approvals = [
        {
            "id": x.id,
            "organization_id": x.organization_id,
            "organization_name": org_map.get(x.organization_id, ""),
            "subject_kind": x.subject_kind,
            "subject_id": x.subject_id,
            "title": x.title,
            "note": x.note,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in appr_r.scalars().all()
    ]
    return {
        "inbox": inbox,
        "approvals": approvals,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
