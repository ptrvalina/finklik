"""Адаптация сложности FinClick к роли и контексту (Flow 8.5)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserOrganizationMembership
from app.schemas.experience import (
    ExperienceMode,
    FeedDensity,
    ProgressiveExperienceMeta,
    SimplifiedStateProjection,
)
from app.schemas.financial_state import FinancialState
from app.schemas.operations_feed import ExecutionFeedResponse, OperationalItem
from app.schemas.state_governance import TruthGovernanceOverlay


async def _membership_count(db: AsyncSession, user_id: str) -> int:
    r = await db.execute(
        select(func.count(UserOrganizationMembership.id)).where(UserOrganizationMembership.user_id == user_id)
    )
    return int(r.scalar() or 0)


async def resolve_experience_mode(db: AsyncSession, user: User) -> ExperienceMode:
    role = (user.role or "").strip().lower()
    if role == "owner":
        return "advanced"
    if role == "admin":
        return "operator"
    if role == "accountant":
        n = await _membership_count(db, str(user.id))
        return "accountant" if n > 1 else "operator"
    if role in ("manager", "viewer"):
        return "solo"
    return "operator"


def _feed_density(mode: ExperienceMode) -> FeedDensity:
    return {"solo": "minimal", "operator": "standard", "accountant": "standard", "advanced": "full"}[mode]


def build_simplified_projection(fs: FinancialState) -> SimplifiedStateProjection:
    """Спокойный текст без терминов governance / dimension."""
    lines: list[str] = []
    if fs.document_completeness.score < 65:
        lines.append("Есть незавершённые документы перед отчётностью — стоит добить первичку.")
    elif fs.document_completeness.pending_ocr > 0 or fs.document_completeness.needs_review > 0:
        lines.append("Часть документов ещё в обработке или на вашей проверке.")
    if fs.compliance_state.level == "blocked":
        lines.append("Есть просрочки или критичные запросы — без этого сложнее закрыть период спокойно.")
    elif fs.compliance_state.level == "attention":
        lines.append("Нужно разобрать согласования или входящие запросы.")
    if fs.reporting_status.status in ("at_risk", "blocked"):
        lines.append("Отчётность пока не в «зелёной зоне» — лучше поправить журнал и документы.")
    if fs.cashflow_state.level == "critical":
        lines.append("Кассовое давление заметно — проверьте выплаты и обязательства.")
    elif fs.cashflow_state.level == "tight":
        lines.append("Касса напряжённая — имеет смысл сверить расходы месяца.")

    headline = lines[0] if lines else "Сейчас выглядит спокойно для текущего этапа — можно поддерживать порядок в учёте."
    supporting = " ".join(lines[1:3]) if len(lines) > 1 else None
    readiness_plain = f"Готовность данных около {fs.operational_readiness.score}% — {'можно готовить отчёты спокойнее' if fs.operational_readiness.score >= 80 else 'есть куда подтянуть перед сдачей'}."
    return SimplifiedStateProjection(headline=headline, supporting_line=supporting, readiness_plain=readiness_plain)


def _primary_focus_hint(fs: FinancialState, top_title: str | None) -> str:
    if fs.risk_level in ("high", "critical"):
        return "Сначала снимите главный риск по отчётности и документам — так спокойнее для проверок."
    if top_title:
        return f"Логичный следующий шаг: {top_title[:120]}{'…' if len(top_title) > 120 else ''}"
    return "Поддерживайте журнал и первичку в порядке — это база спокойной отчётности."


def _humanize_item(it: OperationalItem, mode: ExperienceMode) -> OperationalItem:
    if mode not in ("solo", "operator"):
        return it
    ai = it.ai_why or ""
    ai = ai.replace("OCR", "распознавание").replace("KУДиР", "книга учёта")
    hint = it.state_transition_hint
    if hint and mode in ("solo", "operator"):
        if any(x in hint for x in ("reporting_status", "compliance_state", "document_completeness", "cashflow_state")):
            hint = (
                "Это влияет на то, насколько спокойно закроется период и отчётность."
                if mode == "solo"
                else "После правок обычно спокойнее закрывается период и отчётность."
            )
    tags = it.governance_tags
    if mode == "solo":
        tags = []
    return it.model_copy(update={"ai_why": ai or it.ai_why, "state_transition_hint": hint, "governance_tags": tags})


def _slim_truth_for_accountant(tg: TruthGovernanceOverlay) -> TruthGovernanceOverlay:
    return tg.model_copy(update={"rules_catalog": []})


def apply_progressive_experience(
    mode: ExperienceMode,
    response: ExecutionFeedResponse,
) -> ExecutionFeedResponse:
    fs = response.financial_state
    autonomy = response.default_autonomy_mode
    if mode == "solo":
        autonomy = "suggest"

    if fs is None:
        meta = ProgressiveExperienceMeta(mode=mode, feed_density=_feed_density(mode))
        return response.model_copy(
            update={"progressive_experience": meta, "default_autonomy_mode": autonomy}
        )

    wf_main = list(response.workflow_maintenance)
    mem_hints = list(response.operational_memory_hints)
    if mode == "solo":
        wf_main = wf_main[:2]
        mem_hints = mem_hints[:2]
    elif mode == "operator":
        wf_main = wf_main[:4]
        mem_hints = mem_hints[:3]

    simplified = build_simplified_projection(fs)
    density = _feed_density(mode)
    top_title = response.top_action.title if response.top_action else None
    focus = _primary_focus_hint(fs, top_title)

    items = list(response.items)
    work_packs = list(response.work_packs)
    preds = list(response.state_predictions)
    truth = response.truth_governance
    audit = list(response.recent_state_audit)

    if mode == "solo":
        items = [_humanize_item(it, mode) for it in items[:5]]
        work_packs = []
        preds = preds[:1]
        truth = None
        audit = []
    elif mode == "operator":
        items = [_humanize_item(it, mode) for it in items]
        preds = preds[:2]
        truth = None
        audit = []
    elif mode == "accountant":
        items = items
        if truth:
            truth = _slim_truth_for_accountant(truth)
        audit = audit[:5]
    else:  # advanced
        items = items

    meta = ProgressiveExperienceMeta(
        mode=mode,
        feed_density=density,
        simplified_state=simplified,
        primary_focus_hint=focus,
    )

    pending = len(items)
    blocked = sum(1 for x in items if x.priority == "critical")
    top = items[0] if items else None

    return response.model_copy(
        update={
            "items": items,
            "work_packs": work_packs,
            "state_predictions": preds,
            "truth_governance": truth,
            "recent_state_audit": audit,
            "pending_count": pending,
            "blocked_count": blocked,
            "top_action": top,
            "progressive_experience": meta,
            "default_autonomy_mode": autonomy,
            "workflow_maintenance": wf_main,
            "operational_memory_hints": mem_hints,
        }
    )
