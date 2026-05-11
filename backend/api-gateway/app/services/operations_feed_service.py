"""Сборка операционной ленты: журнал, OCR, inbox, согласования, отчётность, сверка."""

from __future__ import annotations

from datetime import date

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.core.datetime_utils import utc_now_naive
from app.models.business_os import ReconciliationMatch
from app.models.collaboration import ApprovalRequest, OperationalInboxItem
from app.models.document import ScannedDocument
from app.models.transaction import Transaction
from app.schemas.financial_state import FinancialState
from app.schemas.operations_feed import (
    ExecutionFeedResponse,
    OperationalItem,
    OperationalItemType,
    OperationalPriority,
)
from app.schemas.reporting_calm import ConsistencyIssue
from app.schemas.flow9_automation import CalmUiBudget
from app.services.adaptive_priority_service import adaptive_priority_sort
from app.services.automation_trust_service import build_trusted_automation_profile
from app.services.financial_memory_service import load_operational_memory_hints
from app.services.financial_state_service import infer_autonomy_mode
from app.services.operational_health_engine import compute_operational_health
from app.services.operational_noise_service import collapse_operational_noise
from app.services.reporting_calm_service import build_reporting_calm_overview
from app.schemas.state_governance import TruthGovernanceOverlay
from app.services.state_truth_governance_service import (
    assess_truth_governance,
    load_recent_audit_entries,
    persist_state_audit_if_changed,
)
from app.services.progressive_experience_service import (
    apply_progressive_experience,
    resolve_experience_mode,
)
from app.services.workflow_maintenance_service import build_workflow_maintenance_suggestions
from app.services.work_pack_service import build_work_packs, infer_state_dimension

PRIORITY_RANK: dict[str, int] = {"critical": 4, "high": 3, "medium": 2, "low": 1}

READINESS_THRESHOLD = 80

# Внутри одного уровня приоритета — вес по типу (бизнес-влияние).
TYPE_WEIGHT: dict[OperationalItemType, int] = {
    "reporting": 50,
    "reconciliation": 45,
    "document": 40,
    "approval": 35,
    "transaction": 30,
}


def _clamp_pri(p: str) -> OperationalPriority:
    if p in PRIORITY_RANK:
        return p  # type: ignore[return-value]
    return "medium"


def _severity_to_priority(severity: str) -> OperationalPriority:
    s = (severity or "").lower()
    if s == "risk":
        return "critical"
    if s == "attention":
        return "high"
    return "medium"


def _issue_to_item_type(issue: ConsistencyIssue) -> OperationalItemType:
    if issue.id in ("ocr_queue",):
        return "document"
    return "transaction"


def _sort_items(items: list[OperationalItem]) -> list[OperationalItem]:
    def key(it: OperationalItem) -> tuple[int, int, str]:
        return (
            PRIORITY_RANK.get(it.priority, 0),
            TYPE_WEIGHT.get(it.type, 0),
            it.title,
        )

    return sorted(items, key=key, reverse=True)


def _transition_hint(it: OperationalItem, fs: FinancialState) -> str | None:
    dim = infer_state_dimension(it)
    if dim == "reporting_status" and fs.reporting_status.status == "blocked":
        return "После правок reporting_status обычно переходит в preparing → ready."
    if dim == "compliance_state" and fs.compliance_state.level == "blocked":
        return "Закрытие просрочек и документов снимает блок compliance_state."
    if dim == "document_completeness" and fs.document_completeness.score < 60:
        return "Улучшение первички повышает document_completeness и снижает риск проверки."
    if dim == "cashflow_state" and fs.cashflow_state.level != "healthy":
        return "Выравнивание журнала и обязательств стабилизирует cashflow_state."
    return None


def _annotate_item(it: OperationalItem, fs: FinancialState) -> OperationalItem:
    dim = infer_state_dimension(it)
    hint = _transition_hint(it, fs)
    return it.model_copy(update={"state_dimension": dim, "state_transition_hint": hint})


def _apply_truth_tags(
    it: OperationalItem,
    overlay: TruthGovernanceOverlay,
) -> OperationalItem:
    tags: list[str] = []
    dim = it.state_dimension
    if dim:
        d = str(dim)
        for c in overlay.conflicts:
            if d in c.affected_dimensions:
                tags.append("conflict_detected")
                break
        if d in overlay.frozen_dimensions:
            tags.append("frozen_state")
    if it.type == "approval" and overlay.mutation_level_by_dimension.get("compliance_state") == "user_confirmed":
        tags.append("requires_confirmation")
    if overlay.governance_violations and dim == "compliance_state":
        tags.append("governance_violation")
    tc = overlay.state_confidence
    if "conflict_detected" in tags:
        tc = max(0.2, tc - 0.12)
    return it.model_copy(update={"governance_tags": tags, "truth_confidence": round(tc, 3)})


async def build_execution_feed(
    db: AsyncSession,
    organization_id: str,
    user: User | None = None,
) -> ExecutionFeedResponse:
    today = utc_now_naive().date()
    month_start = date(today.year, today.month, 1)
    items: list[OperationalItem] = []

    overview = await build_reporting_calm_overview(db, organization_id, include_financial_state=True)
    fs = overview.financial_state
    state_predictions = overview.state_predictions or []
    if fs is None:
        from app.services.financial_state_service import derive_financial_state

        fs, state_predictions = await derive_financial_state(db, organization_id, overview=overview)

    for issue in overview.consistency_issues:
        pri = _severity_to_priority(issue.severity)
        itype = _issue_to_item_type(issue)
        items.append(
            OperationalItem(
                id=f"calm-issue-{issue.id}",
                type=itype,
                priority=pri,
                status="open",
                entity_id=issue.id,
                title=issue.title,
                context=issue.detail,
                action_path=issue.action_path,
                ai_why=issue.fix_hint,
            )
        )

    score = overview.readiness.score
    if score < READINESS_THRESHOLD:
        pri: OperationalPriority = "critical" if score < 50 else "high"
        items.append(
            OperationalItem(
                id="readiness-gate",
                type="reporting",
                priority=pri,
                status="open",
                entity_id=organization_id,
                title=f"Готовность отчётности {score}% — ниже порога {READINESS_THRESHOLD}%",
                context="Исправьте замечания в журнале и документах перед сдачей.",
                action_path="/reports",
                ai_why=overview.readiness.suggested_fixes[0] if overview.readiness.suggested_fixes else None,
            )
        )

    for ti in overview.timeline:
        if ti.state not in ("overdue", "needs_attention"):
            continue
        pri = "critical" if ti.state == "overdue" else "high"
        path = "/calendar"
        if ti.kind == "obligation":
            path = "/bank"
        elif ti.kind == "submission":
            path = "/reports"
        elif ti.kind == "tax_calendar":
            path = "/calendar"
        title = ti.title
        if ti.state == "overdue":
            title = f"Просрочено: {ti.title}"
        items.append(
            OperationalItem(
                id=f"timeline-{ti.id}",
                type="reporting",
                priority=pri,
                status="open",
                entity_id=ti.id,
                title=title,
                context=ti.subtitle or ti.meta,
                action_path=path,
                ai_why="Влияет на своевременную сдачу и штрафные риски.",
            )
        )

    # Черновики журнала за текущий месяц (средний приоритет).
    draft_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.status == "draft",
                Transaction.transaction_date >= month_start,
            )
        )
    )
    draft_n = int(draft_q.scalar() or 0)
    if draft_n > 0:
        pri_d: OperationalPriority = "high" if draft_n > 5 else "medium"
        items.append(
            OperationalItem(
                id="journal-drafts-month",
                type="transaction",
                priority=pri_d,
                status="open",
                entity_id="drafts",
                title=f"Черновики в журнале: {draft_n} за текущий месяц",
                context="Проведите или удалите черновики — иначе показатели месяца неполные.",
                action_path="/accounting",
                ai_why="Черновики искажают готовность отчётности и KУДиР.",
            )
        )

    # OCR: необработанная очередь (не попадает только в needs_review-срез calm).
    pend = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(
                ScannedDocument.organization_id == organization_id,
                ScannedDocument.status.in_(["pending", "processing"]),
            )
        )
    )
    pend_n = int(pend.scalar() or 0)
    if pend_n > 0:
        items.append(
            OperationalItem(
                id="ocr-pipeline-queue",
                type="document",
                priority="critical",
                status="open",
                entity_id="ocr-queue",
                title=f"Документы в обработке OCR: {pend_n}",
                context="Дождитесь распознавания или повторите загрузку при ошибке.",
                action_path="/scan",
                ai_why="Без распознанных первичных документов выше риск при проверке.",
            )
        )

    low_conf_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(
                ScannedDocument.organization_id == organization_id,
                ScannedDocument.status == "done",
                ScannedDocument.confidence < 50,
                ScannedDocument.lifecycle_status != "confirmed",
            )
        )
    )
    low_conf_n = int(low_conf_q.scalar() or 0)
    if low_conf_n > 0:
        items.append(
            OperationalItem(
                id="ocr-low-confidence",
                type="document",
                priority="high",
                status="open",
                entity_id="ocr-low-conf",
                title=f"Низкая уверенность OCR: {low_conf_n} документ(ов)",
                context="Проверьте поля и подтвердите документ.",
                action_path="/scan",
                ai_why="Ошибки OCR ведут к неверным проводкам и отчётности.",
            )
        )

    # Сверка: предложения к подтверждению.
    rec_q = await db.execute(
        select(func.count(ReconciliationMatch.id)).where(
            and_(
                ReconciliationMatch.organization_id == organization_id,
                ReconciliationMatch.status == "suggested",
            )
        )
    )
    rec_n = int(rec_q.scalar() or 0)
    if rec_n > 0:
        items.append(
            OperationalItem(
                id="reconciliation-suggested",
                type="reconciliation",
                priority="high",
                status="open",
                entity_id="reconciliation",
                title=f"Подтвердите {rec_n} предложений сверки банк ↔ документы",
                context="Подтверждение фиксирует связь для аудита и отчётов.",
                action_path="/bank",
                ai_why="Неподтверждённая сверка оставляет разрыв между выпиской и учётом.",
            )
        )

    # Согласования.
    appr_rows = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.organization_id == organization_id,
            ApprovalRequest.status.in_(["pending", "rejected", "clarification"]),
        )
    )
    for row in appr_rows.scalars().all():
        st = (row.status or "").lower()
        if st == "pending":
            pri_a: OperationalPriority = "high"
            title = row.title
            why = "Блокирует закрытие операции или проведение без подписи ответственного."
        else:
            pri_a = "high" if st == "rejected" else "medium"
            title = f"Согласование: {row.title} — требуется доработка"
            why = "Ответ по согласованию нужен, чтобы закрыть задачу и избежать повторного цикла."
        items.append(
            OperationalItem(
                id=f"approval-{row.id}",
                type="approval",
                priority=pri_a,
                status="open",
                entity_id=row.id,
                title=title,
                context=row.note,
                action_path="/workspace",
                ai_why=why,
            )
        )

    # Операционный inbox.
    inbox_rows = await db.execute(
        select(OperationalInboxItem).where(
            OperationalInboxItem.organization_id == organization_id,
            OperationalInboxItem.status == "open",
        )
    )
    for row in inbox_rows.scalars().all():
        kind = (row.kind or "").lower()
        if kind == "missing_document":
            pri_i: OperationalPriority = "critical"
            why = "Без документа нельзя подтвердить расход или сдачу."
        elif kind == "document_request":
            pri_i = "high"
            why = "Запрошенный документ нужен для закрытия периода или ответа контрагенту."
        elif kind == "upload_reminder":
            pri_i = "medium"
            why = "Напоминание снижает риск пропуска первички."
        else:
            pri_i = "medium"
            why = "Входящая операционная задача по организации."
        if (row.priority or "").lower() == "high" and PRIORITY_RANK[pri_i] < PRIORITY_RANK["high"]:
            pri_i = "high"
        items.append(
            OperationalItem(
                id=f"inbox-{row.id}",
                type="document",
                priority=_clamp_pri(pri_i),
                status="open",
                entity_id=row.id,
                title=row.title,
                context=(row.body or "")[:500] or None,
                action_path="/workspace",
                ai_why=why,
            )
        )

    # Дедуп по id (на случай пересечения timeline и obligation).
    seen: set[str] = set()
    deduped: list[OperationalItem] = []
    for it in items:
        if it.id in seen:
            continue
        seen.add(it.id)
        deduped.append(it)

    collapsed = collapse_operational_noise(deduped)
    sorted_items = _sort_items(collapsed)
    sorted_items = [_annotate_item(it, fs) for it in sorted_items]

    truth_gov = await assess_truth_governance(db, organization_id, fs)
    sorted_items = [_apply_truth_tags(it, truth_gov) for it in sorted_items]

    health = compute_operational_health(
        fs,
        truth_gov,
        open_operational_item_count=len(sorted_items),
        predictions=state_predictions,
    )
    sorted_items = adaptive_priority_sort(sorted_items, fs, health, state_predictions)

    blocked = sum(1 for x in sorted_items if x.priority == "critical")
    top = sorted_items[0] if sorted_items else None
    work_packs = build_work_packs(sorted_items, fs)

    await persist_state_audit_if_changed(db, organization_id, fs)
    recent_audit = await load_recent_audit_entries(db, organization_id, limit=8)

    maintenance = build_workflow_maintenance_suggestions(fs, overview)
    memory_hints = await load_operational_memory_hints(db, organization_id)
    trust_profile = build_trusted_automation_profile(fs, truth_gov)
    calm_budget = CalmUiBudget(
        max_visible_alerts=3 if health.composite >= 62 else 5,
        max_parallel_priorities=1,
        dominant_next_action_enforced=True,
    )

    raw = ExecutionFeedResponse(
        items=sorted_items,
        top_action=top,
        pending_count=len(sorted_items),
        blocked_count=blocked,
        readiness_score=score,
        ai_summary=overview.ai_summary,
        financial_state=fs,
        work_packs=work_packs,
        state_predictions=state_predictions,
        default_autonomy_mode=infer_autonomy_mode(fs),
        truth_governance=truth_gov,
        recent_state_audit=recent_audit,
        operational_health=health,
        trusted_automation=trust_profile,
        workflow_maintenance=maintenance,
        operational_memory_hints=memory_hints,
        calm_ui_budget=calm_budget,
    )
    mode = await resolve_experience_mode(db, user) if user else "operator"
    return apply_progressive_experience(mode, raw)
