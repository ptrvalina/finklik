"""Движок вывода FinancialState: события/данные → единая модель (без дублирования бизнес-правил calm / BusinessState)."""

from __future__ import annotations

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now_naive
from app.models.collaboration import ApprovalRequest, OperationalInboxItem
from app.models.document import ScannedDocument
from app.schemas.business_os import BusinessStateResponse
from app.schemas.financial_state import (
    AIActionMode,
    CashflowStateBlock,
    ComplianceStateBlock,
    DocumentCompletenessBlock,
    FinancialState,
    OperationalReadinessBlock,
    ReportingStatusBlock,
    StatePrediction,
)
from app.schemas.reporting_calm import ReportingCalmOverview
from app.services.business_state_service import compute_business_state


def _cashflow_level(bs: BusinessStateResponse) -> tuple[str, str]:
    h = bs.financial_health_status
    if h == "risk":
        return "critical", "Текущий месяц и обязательства создают повышенный кассовый риск."
    if h == "warning":
        return "tight", "Касса и расходы требуют внимания в ближайшие дни."
    return "healthy", "Ликвидность и расходы выглядят управляемыми при текущих данных журнала."


def _reporting_blocker_codes(overview: ReportingCalmOverview) -> list[str]:
    return [b.code for b in overview.readiness.blockers]


def infer_autonomy_mode(fs: FinancialState) -> AIActionMode:
    if fs.risk_level == "critical":
        return "execute_with_approval"
    if fs.risk_level == "high":
        return "prepare"
    if fs.risk_level == "medium":
        return "suggest"
    return "observe"


def _reporting_status(overview: ReportingCalmOverview) -> ReportingStatusBlock:
    score = overview.readiness.score
    codes = _reporting_blocker_codes(overview)
    if score >= 85 and not codes:
        st = "ready"
        summary = "Данных достаточно для спокойной подготовки отчётности."
    elif score >= 60:
        st = "preparing"
        summary = "Подготовка отчётности идёт; есть замечания по журналу или документам."
    elif score >= 40:
        st = "at_risk"
        summary = "Готовность ниже комфортного уровня — отчётность может задержаться."
    else:
        st = "blocked"
        summary = "Блокирующие расхождения в журнале или документах — закрытие периода под угрозой."

    return ReportingStatusBlock(
        status=st,
        readiness_score=score,
        blocker_codes=codes,
        summary=summary,
    )


def _overall_risk(
    *,
    bs: BusinessStateResponse,
    overview: ReportingCalmOverview,
    doc_score: int,
    pending_appr: int,
    crit_inbox: int,
) -> tuple[str, StatePrediction | None]:
    score = overview.readiness.score
    primary: StatePrediction | None = None

    if bs.financial_health_status == "risk" and score < 40:
        primary = StatePrediction(
            id="risk-stack",
            horizon_days=3,
            message="Одновременное давление на кассу и отчётность — высокий риск срыва контрольных сроков.",
            affected_dimension="reporting_status",
            severity="risk",
        )
        return "critical", primary

    if score < 50:
        primary = StatePrediction(
            id="p-readiness",
            horizon_days=7,
            message="Низкая готовность отчётности — риск срыва сроков сдачи при отсутствии правок.",
            affected_dimension="reporting_status",
            severity="risk",
        )
        return "high", primary

    if bs.overdue_obligations_count > 0 or crit_inbox > 0:
        primary = StatePrediction(
            id="p-compliance",
            horizon_days=5,
            message="Просрочки или критичные запросы по документам повышают регламентный риск.",
            affected_dimension="compliance_state",
            severity="risk",
        )
        return "high", primary

    if bs.financial_health_status == "risk" or doc_score < 40:
        primary = StatePrediction(
            id="p-doc-cash",
            horizon_days=10,
            message="Касса или первичка требуют выравнивания — возможна деградация отчётной картины.",
            affected_dimension="document_completeness",
            severity="warning",
        )
        return "medium", primary

    if score < 80 or bs.financial_health_status == "warning" or pending_appr > 0:
        return "medium", None

    return "low", None


async def derive_financial_state(
    db: AsyncSession,
    organization_id: str,
    *,
    overview: ReportingCalmOverview | None = None,
    business_state: BusinessStateResponse | None = None,
) -> tuple[FinancialState, list[StatePrediction]]:
    if overview is None:
        from app.services.reporting_calm_service import build_reporting_calm_overview as _calm

        overview = await _calm(db, organization_id, include_financial_state=False)
    if business_state is None:
        business_state = await compute_business_state(db, organization_id)

    bs = business_state
    ov = overview

    cf_level, cf_summary = _cashflow_level(bs)
    monthly_net = bs.monthly_revenue - bs.monthly_expenses

    cashflow_state = CashflowStateBlock(
        level=cf_level,  # type: ignore[arg-type]
        monthly_net=monthly_net,
        health_signal=bs.financial_health_status,  # type: ignore[arg-type]
        summary=cf_summary,
    )

    operational_readiness = OperationalReadinessBlock(
        score=ov.readiness.score,
        confidence=ov.readiness.confidence,
        label="Готовность данных к отчётности и регламентным проверкам.",
    )

    pend_appr_q = await db.execute(
        select(func.count(ApprovalRequest.id)).where(
            and_(ApprovalRequest.organization_id == organization_id, ApprovalRequest.status == "pending")
        )
    )
    pending_appr = int(pend_appr_q.scalar() or 0)

    inbox_open_q = await db.execute(
        select(func.count(OperationalInboxItem.id)).where(
            and_(OperationalInboxItem.organization_id == organization_id, OperationalInboxItem.status == "open")
        )
    )
    inbox_open = int(inbox_open_q.scalar() or 0)

    crit_inbox_q = await db.execute(
        select(func.count(OperationalInboxItem.id)).where(
            and_(
                OperationalInboxItem.organization_id == organization_id,
                OperationalInboxItem.status == "open",
                OperationalInboxItem.kind == "missing_document",
            )
        )
    )
    crit_inbox = int(crit_inbox_q.scalar() or 0)

    if bs.overdue_obligations_count > 0 or crit_inbox > 0:
        comp_level = "blocked"
        comp_summary = "Есть блокирующие несоответствия (просрочки или недостающие документы)."
    elif pending_appr > 0 or inbox_open > 0:
        comp_level = "attention"
        comp_summary = "Требуются согласования или ответы по входящим запросам."
    else:
        comp_level = "clear"
        comp_summary = "Нет открытых блокеров по согласованиям и критичным запросам."

    compliance_state = ComplianceStateBlock(
        level=comp_level,  # type: ignore[arg-type]
        pending_approvals=pending_appr,
        overdue_obligations=bs.overdue_obligations_count,
        open_inbox_items=inbox_open,
        summary=comp_summary,
    )

    pend_ocr_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(
                ScannedDocument.organization_id == organization_id,
                ScannedDocument.status.in_(["pending", "processing"]),
            )
        )
    )
    pend_ocr = int(pend_ocr_q.scalar() or 0)

    review_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(ScannedDocument.organization_id == organization_id, ScannedDocument.status == "needs_review")
        )
    )
    needs_review = int(review_q.scalar() or 0)

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
    low_conf = int(low_conf_q.scalar() or 0)

    doc_penalty = min(100, pend_ocr * 12 + needs_review * 8 + low_conf * 10)
    doc_score = max(0, 100 - doc_penalty)
    document_completeness = DocumentCompletenessBlock(
        score=doc_score,
        pending_ocr=pend_ocr,
        needs_review=needs_review,
        low_confidence_unconfirmed=low_conf,
        summary="Полнота и качество первичных документов относительно учёта.",
    )

    reporting_status = _reporting_status(ov)

    risk, primary_pred = _overall_risk(
        bs=bs,
        overview=ov,
        doc_score=doc_score,
        pending_appr=pending_appr,
        crit_inbox=crit_inbox,
    )

    predictions: list[StatePrediction] = []
    if primary_pred:
        predictions.append(primary_pred)

    if ov.readiness.score < 80 and not any(p.id == "p-readiness-low" for p in predictions):
        predictions.append(
            StatePrediction(
                id="p-readiness-low",
                horizon_days=14,
                message=f"При сохранении текущих замечаний готовность может опуститься ниже {max(30, ov.readiness.score - 15)}% к следующему циклу проверки.",
                affected_dimension="operational_readiness",
                severity="warning",
            )
        )

    if pend_ocr > 0:
        predictions.append(
            StatePrediction(
                id="p-ocr-delay",
                horizon_days=2,
                message="Очередь OCR задерживает подтверждение расходов и сдвигает готовность отчётности.",
                affected_dimension="document_completeness",
                severity="warning",
            )
        )

    fs = FinancialState(
        cashflow_state=cashflow_state,
        operational_readiness=operational_readiness,
        compliance_state=compliance_state,
        document_completeness=document_completeness,
        reporting_status=reporting_status,
        risk_level=risk,  # type: ignore[arg-type]
        derived_at=utc_now_naive(),
    )

    return fs, predictions
