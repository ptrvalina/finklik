"""Движок спокойной отчётности: готовность, проверки согласованности, шкала времени."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now_naive
from app.models.business_os import FinancialObligation
from app.models.document import ScannedDocument
from app.models.employee import CalendarEvent
from app.models.regulatory import ReportSubmission
from app.models.transaction import Transaction
from app.schemas.reporting_calm import (
    ConfidenceLevel,
    ConsistencyIssue,
    ObligationSummaryItem,
    ReadinessBlocker,
    ReadinessSummary,
    ReportingCalmOverview,
    TimelineItem,
    TimelineState,
)


def _confidence(score: int) -> ConfidenceLevel:
    if score >= 85:
        return "high"
    if score >= 60:
        return "medium"
    return "low"


def _submission_timeline_state(status: str) -> TimelineState:
    s = (status or "").lower()
    if s in ("accepted",):
        return "submitted"
    if s in ("rejected",):
        return "needs_attention"
    if s in ("confirmed",):
        return "ready"
    if s in ("pending_review", "submitting"):
        return "preparing"
    return "draft"


def _calendar_timeline_state(ev: CalendarEvent, today: date) -> TimelineState:
    if ev.is_completed:
        return "submitted"
    if ev.event_date < today:
        return "overdue"
    if (ev.event_date - today).days <= 14:
        return "needs_attention"
    return "preparing"


def _obligation_timeline_state(row: FinancialObligation, today: date) -> TimelineState:
    if row.status == "paid":
        return "submitted"
    if row.due_date < today and row.status != "paid":
        return "overdue"
    if row.status == "pending" and (row.due_date - today).days <= 7:
        return "needs_attention"
    if row.status == "pending":
        return "preparing"
    return "draft"


async def build_reporting_calm_overview(
    db: AsyncSession,
    organization_id: str,
    *,
    include_financial_state: bool = True,
) -> ReportingCalmOverview:
    today = utc_now_naive().date()
    month_start = date(today.year, today.month, 1)

    draft_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.status == "draft",
                Transaction.transaction_date >= month_start,
            )
        )
    )
    draft_month = int(draft_q.scalar() or 0)

    uncategorized_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
                Transaction.category.is_(None),
            )
        )
    )
    uncategorized = int(uncategorized_q.scalar() or 0)

    scan_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(
                ScannedDocument.organization_id == organization_id,
                ScannedDocument.status == "needs_review",
            )
        )
    )
    scans_review = int(scan_q.scalar() or 0)

    overdue_ob_q = await db.execute(
        select(func.count(FinancialObligation.id)).where(
            and_(
                FinancialObligation.organization_id == organization_id,
                FinancialObligation.status != "paid",
                FinancialObligation.due_date < today,
            )
        )
    )
    overdue_obligations = int(overdue_ob_q.scalar() or 0)

    dup_q = await db.execute(
        select(Transaction.transaction_date, Transaction.amount, func.count(Transaction.id))
        .where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.transaction_date >= month_start,
            )
        )
        .group_by(Transaction.transaction_date, Transaction.amount)
        .having(func.count(Transaction.id) > 1)
    )
    duplicate_groups = len(dup_q.all())

    score = 100
    blockers: list[ReadinessBlocker] = []
    if draft_month > 0:
        d = min(30, draft_month * 6)
        score -= d
        blockers.append(ReadinessBlocker(code="drafts", label="Черновики в текущем месяце", impact_points=d))
    if uncategorized > 0:
        d = min(25, uncategorized * 5)
        score -= d
        blockers.append(ReadinessBlocker(code="uncategorized", label="Расходы без категории", impact_points=d))
    if scans_review > 0:
        d = min(20, scans_review * 4)
        score -= d
        blockers.append(ReadinessBlocker(code="scans", label="Документы на проверке OCR", impact_points=d))
    if overdue_obligations > 0:
        d = min(25, overdue_obligations * 10)
        score -= d
        blockers.append(ReadinessBlocker(code="overdue_obligations", label="Просроченные обязательства", impact_points=d))
    if duplicate_groups > 0:
        d = min(15, duplicate_groups * 5)
        score -= d
        blockers.append(ReadinessBlocker(code="duplicates", label="Возможные дубликаты операций", impact_points=d))

    score = max(0, score)
    conf = _confidence(score)

    fixes: list[str] = []
    if draft_month:
        fixes.append("Проведите или удалите черновики в журнале за текущий месяц.")
    if uncategorized:
        fixes.append("Назначьте категории расходам или примените подсказки ИИ в учёте.")
    if scans_review:
        fixes.append("Разберите очередь сканов — подтвердите или исправьте распознавание.")
    if overdue_obligations:
        fixes.append("Закройте или перенесите просроченные обязательства в разделе Business OS.")
    if duplicate_groups:
        fixes.append("Сверьте операции с одинаковой датой и суммой — возможен двойной ввод.")

    issues: list[ConsistencyIssue] = []
    if duplicate_groups > 0:
        issues.append(
            ConsistencyIssue(
                id="duplicate_pairs",
                severity="attention",
                title="Повторяющиеся суммы и даты",
                detail=f"Найдено групп с возможным дублированием: {duplicate_groups}.",
                fix_hint="Откройте журнал и проверьте пары операций.",
                action_path="/accounting",
            )
        )
    if uncategorized > 0:
        issues.append(
            ConsistencyIssue(
                id="missing_categories",
                severity="attention",
                title="Неклассифицированные расходы",
                detail=f"Операций без категории: {uncategorized}.",
                fix_hint="Это влияет на аналитику УСН и отчётность.",
                action_path="/accounting",
            )
        )
    if scans_review > 0:
        issues.append(
            ConsistencyIssue(
                id="ocr_queue",
                severity="info",
                title="Документы ждут решения",
                detail=f"В очереди проверки: {scans_review}.",
                fix_hint="Подтвердите или повторите скан.",
                action_path="/scan",
            )
        )

    spike_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
                Transaction.category == "marketing",
            )
        )
    )
    marketing_spike = Decimal(str(spike_q.scalar() or 0))
    total_exp_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
            )
        )
    )
    total_exp = Decimal(str(total_exp_q.scalar() or 0))
    if total_exp > 0 and marketing_spike / total_exp > Decimal("0.45"):
        issues.append(
            ConsistencyIssue(
                id="marketing_ratio",
                severity="info",
                title="Высокая доля маркетинга",
                detail="Большая часть расходов месяца отнесена к маркетингу — проверьте корректность.",
                fix_hint="Убедитесь, что операции отражают факт.",
                action_path="/accounting",
            )
        )

    timeline: list[TimelineItem] = []

    ev_rows = await db.execute(
        select(CalendarEvent)
        .where(
            and_(
                CalendarEvent.organization_id == organization_id,
                CalendarEvent.event_date >= today - timedelta(days=7),
                CalendarEvent.event_date <= today + timedelta(days=120),
            )
        )
        .order_by(CalendarEvent.event_date.asc())
        .limit(40)
    )
    for ev in ev_rows.scalars().all():
        et = "tax" if "налог" in (ev.title or "").lower() or ev.event_type == "tax" else ev.event_type
        timeline.append(
            TimelineItem(
                id=f"cal-{ev.id}",
                kind="tax_calendar",
                title=ev.title,
                date=ev.event_date,
                state=_calendar_timeline_state(ev, today),
                subtitle="Календарь",
                meta=et,
            )
        )

    ob_rows = await db.execute(
        select(FinancialObligation)
        .where(FinancialObligation.organization_id == organization_id)
        .order_by(FinancialObligation.due_date.asc())
        .limit(25)
    )
    obligations_preview: list[ObligationSummaryItem] = []
    for ob in ob_rows.scalars().all():
        days = (ob.due_date - today).days if ob.due_date else None
        obligations_preview.append(
            ObligationSummaryItem(
                id=ob.id,
                obligation_type=ob.obligation_type,
                amount=ob.amount,
                due_date=ob.due_date,
                status=ob.status,
                days_until_due=days,
            )
        )
        timeline.append(
            TimelineItem(
                id=f"ob-{ob.id}",
                kind="obligation",
                title=f"{ob.obligation_type.upper()} · {ob.amount} BYN",
                date=ob.due_date,
                state=_obligation_timeline_state(ob, today),
                subtitle="Обязательство",
                meta=ob.status,
            )
        )

    sub_rows = await db.execute(
        select(ReportSubmission)
        .where(ReportSubmission.organization_id == organization_id)
        .order_by(ReportSubmission.updated_at.desc())
        .limit(15)
    )
    for sub in sub_rows.scalars().all():
        sub_dt = sub.updated_at or sub.created_at
        sub_date = sub_dt.date() if sub_dt and hasattr(sub_dt, "date") else today
        timeline.append(
            TimelineItem(
                id=f"sub-{sub.id}",
                kind="submission",
                title=f"{sub.authority.upper()} · {sub.report_type} ({sub.report_period})",
                date=sub_date,
                state=_submission_timeline_state(sub.status),
                subtitle="Отправка отчёта",
                meta=sub.status,
            )
        )

    timeline.sort(key=lambda x: x.date)

    ai_summary = (
        f"Готовность {score}% ({conf}). "
        + (
            "Данные выглядят согласованными — можно продолжать подготовку отчётов."
            if score >= 80
            else "Есть замечания по журналу и документам — устраните их перед сдачей, чтобы снизить риски."
        )
    )

    overview = ReportingCalmOverview(
        readiness=ReadinessSummary(score=score, confidence=conf, blockers=blockers, suggested_fixes=fixes),
        consistency_issues=issues,
        timeline=timeline[:60],
        obligations_preview=obligations_preview[:12],
        ai_summary=ai_summary,
        generated_at=utc_now_naive(),
    )
    if include_financial_state:
        from app.services.financial_state_service import derive_financial_state

        fs, preds = await derive_financial_state(db, organization_id, overview=overview)
        return overview.model_copy(update={"financial_state": fs, "state_predictions": preds})
    return overview
