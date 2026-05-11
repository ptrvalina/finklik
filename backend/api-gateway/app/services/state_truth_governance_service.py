"""Движок истины и управления состоянием: правила, конфликты, заморозки, аудит (Flow 7)."""

from __future__ import annotations

import hashlib
import json
from datetime import timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.regulatory import ReportSubmission
from app.models.state_audit import FinancialStateAuditEntry
from app.models.transaction import Transaction
from app.models.document import ScannedDocument
from app.schemas.financial_state import FinancialState
from app.schemas.state_governance import (
    ConflictSignal,
    StateAuditEntry,
    StateGovernanceRule,
    StateMutationLevel,
    TruthGovernanceOverlay,
)

GOVERNANCE_RULES: list[StateGovernanceRule] = [
    StateGovernanceRule(
        state_field="cashflow_state",
        allowed_sources=["transactions", "financial_obligations", "business_state_service"],
        validation_rule="Только из журнала и обязательств; без ручного override полей.",
        priority=100,
        requires_confirmation=False,
    ),
    StateGovernanceRule(
        state_field="document_completeness",
        allowed_sources=["scanned_documents", "ocr_pipeline"],
        validation_rule="OCR и загрузки; ИИ может только предлагать правки при низкой уверенности.",
        priority=80,
        requires_confirmation=False,
    ),
    StateGovernanceRule(
        state_field="compliance_state",
        allowed_sources=["approval_requests", "operational_inbox", "financial_obligations"],
        validation_rule="Согласования и входящие; конфликт → подтверждение пользователя.",
        priority=90,
        requires_confirmation=True,
    ),
    StateGovernanceRule(
        state_field="reporting_status",
        allowed_sources=["reporting_calm_overview", "report_submissions"],
        validation_rule="Готовность calm + статус отправок; при отправке — заморозка снимка периода.",
        priority=95,
        requires_confirmation=True,
    ),
    StateGovernanceRule(
        state_field="operational_readiness",
        allowed_sources=["reporting_calm_overview"],
        validation_rule="Агрегат правил журнала и документов; не редактируется вручную.",
        priority=85,
        requires_confirmation=False,
    ),
]


def _state_fingerprint(fs: FinancialState) -> str:
    payload = fs.model_dump(mode="json")
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def financial_state_fingerprint(fs: FinancialState) -> str:
    """Публичный отпечаток снимка для согласованности и ETag-подобных проверок (Flow 10)."""
    return _state_fingerprint(fs)


def _short_summary(fs: FinancialState) -> str:
    return json.dumps(
        {
            "risk": fs.risk_level,
            "readiness": fs.operational_readiness.score,
            "reporting": fs.reporting_status.status,
            "compliance": fs.compliance_state.level,
            "docs": fs.document_completeness.score,
            "cash": fs.cashflow_state.level,
        },
        ensure_ascii=False,
    )


async def _active_submission_freeze(db: AsyncSession, organization_id: str) -> bool:
    r = await db.execute(
        select(func.count(ReportSubmission.id)).where(
            and_(
                ReportSubmission.organization_id == organization_id,
                ReportSubmission.status.in_(["submitting", "pending_review"]),
            )
        )
    )
    return int(r.scalar() or 0) > 0


async def assess_truth_governance(
    db: AsyncSession,
    organization_id: str,
    fs: FinancialState,
) -> TruthGovernanceOverlay:
    frozen: list[str] = []
    if await _active_submission_freeze(db, organization_id):
        frozen.append("reporting_status")

    conflicts: list[ConflictSignal] = []

    uncategorized_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.category.is_(None),
            )
        )
    )
    uncategorized = int(uncategorized_q.scalar() or 0)

    review_docs_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(
                ScannedDocument.organization_id == organization_id,
                ScannedDocument.status == "needs_review",
            )
        )
    )
    review_docs = int(review_docs_q.scalar() or 0)

    if uncategorized > 0 and review_docs > 0:
        conflicts.append(
            ConflictSignal(
                id="journal-vs-ocr-queue",
                severity="medium",
                title="Журнал и первичка расходятся по покрытию",
                detail=f"Расходы без категории: {uncategorized}; документы на проверке OCR: {review_docs}.",
                affected_dimensions=["document_completeness", "operational_readiness"],
            )
        )

    linked_gap_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            and_(
                ScannedDocument.organization_id == organization_id,
                ScannedDocument.lifecycle_status.in_(["uploaded", "parsed"]),
                ScannedDocument.status == "done",
            )
        )
    )
    unlinked_done = int(linked_gap_q.scalar() or 0)
    if unlinked_done > 0:
        conflicts.append(
            ConflictSignal(
                id="documents-not-matched",
                severity="low",
                title="Документы распознаны, но не привязаны к учёту",
                detail=f"Документов без финального сопоставления: {unlinked_done}.",
                affected_dimensions=["document_completeness"],
            )
        )

    violations: list[str] = []
    if fs.compliance_state.level == "blocked" and conflicts:
        violations.append(
            "Комплаенс заблокирован при активных межисточниковых расхождениях — устраните конфликты до закрытия периода."
        )

    mutation_level_by_dimension: dict[str, StateMutationLevel] = {
        "cashflow_state": "system_auto",
        "operational_readiness": "system_auto",
        "document_completeness": "ai_suggested" if fs.document_completeness.low_confidence_unconfirmed > 0 else "system_auto",
        "compliance_state": "user_confirmed" if fs.compliance_state.pending_approvals > 0 else "system_auto",
        "reporting_status": "frozen" if "reporting_status" in frozen else "system_auto",
    }

    base_conf = 0.92
    base_conf -= 0.06 * len(conflicts)
    base_conf -= 0.08 * (1 if fs.risk_level in ("high", "critical") else 0)
    base_conf -= 0.05 * len(frozen)
    conf = max(0.35, min(1.0, base_conf))

    return TruthGovernanceOverlay(
        governance_version="flow7-v1",
        state_confidence=round(conf, 3),
        frozen_dimensions=frozen,
        mutation_level_by_dimension=mutation_level_by_dimension,
        conflicts=conflicts,
        governance_violations=violations,
        rules_catalog=list(GOVERNANCE_RULES),
    )


async def persist_state_audit_if_changed(
    db: AsyncSession,
    organization_id: str,
    fs: FinancialState,
    *,
    trigger_event: str = "FinancialStateDerived",
    actor_type: str = "system",
    actor_user_id: str | None = None,
) -> FinancialStateAuditEntry | None:
    fp = _state_fingerprint(fs)
    prev_row = await db.execute(
        select(FinancialStateAuditEntry)
        .where(FinancialStateAuditEntry.organization_id == organization_id)
        .order_by(FinancialStateAuditEntry.created_at.desc())
        .limit(1)
    )
    last = prev_row.scalar_one_or_none()
    if last and last.state_fingerprint == fp:
        return None

    row = FinancialStateAuditEntry(
        organization_id=organization_id,
        state_fingerprint=fp,
        previous_fingerprint=last.state_fingerprint if last else None,
        previous_state_json=last.new_state_json if last else None,
        new_state_json=fs.model_dump_json(),
        trigger_event=trigger_event,
        source="state_truth_governance_service",
        actor_type=actor_type,
        actor_user_id=actor_user_id,
    )
    db.add(row)
    await db.flush()
    return row


async def load_recent_audit_entries(
    db: AsyncSession,
    organization_id: str,
    *,
    limit: int = 8,
) -> list[StateAuditEntry]:
    r = await db.execute(
        select(FinancialStateAuditEntry)
        .where(FinancialStateAuditEntry.organization_id == organization_id)
        .order_by(FinancialStateAuditEntry.created_at.desc())
        .limit(limit)
    )
    rows = r.scalars().all()
    out: list[StateAuditEntry] = []
    for row in rows:
        prev_summary = None
        if row.previous_state_json:
            try:
                prev_summary = _short_summary(FinancialState.model_validate_json(row.previous_state_json))
            except Exception:
                prev_summary = row.previous_state_json[:500]
        try:
            new_summary = _short_summary(FinancialState.model_validate_json(row.new_state_json))
        except Exception:
            new_summary = row.new_state_json[:500]
        out.append(
            StateAuditEntry(
                id=row.id,
                previous_state_summary=prev_summary,
                new_state_summary=new_summary,
                trigger_event=row.trigger_event,
                source=row.source,
                actor=row.actor_user_id or row.actor_type,
                timestamp=row.created_at.replace(tzinfo=timezone.utc)
                if row.created_at.tzinfo is None
                else row.created_at,
            )
        )
    return out
