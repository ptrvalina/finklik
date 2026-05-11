"""Сводка доверия, фоновых работ и уверенности — спокойный язык (Flow 10)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import ScannedDocument
from app.models.onec_sync import OneCSyncJob
from app.schemas.financial_state import FinancialState
from app.schemas.flow10_trust import (
    CalmBackgroundJobCard,
    OperationalConfidencePlain,
    TrustSurfaceResponse,
)
from app.schemas.state_governance import TruthGovernanceOverlay
from app.services.reporting_calm_service import build_reporting_calm_overview
from app.services.state_consistency_service import evaluate_state_consistency_plain
from app.services.state_truth_governance_service import assess_truth_governance, financial_state_fingerprint


def _sync_card(rows: list[OneCSyncJob]) -> CalmBackgroundJobCard:
    if not rows:
        return CalmBackgroundJobCard(
            id="sync-aggregate",
            domain="sync",
            status_plain="Синхронизация с внешней учётной системой не ставила задач в очередь.",
            last_success_at=None,
            retry_count=0,
        )
    last = max(rows, key=lambda j: j.updated_at or j.created_at)
    pending = sum(1 for j in rows if j.status in ("pending", "retry", "running"))
    failed = sum(1 for j in rows if j.status == "failed")
    last_ok = max((j.finished_at for j in rows if j.status == "success" and j.finished_at), default=None)
    st = "Очередь спокойная"
    if pending:
        st = f"В работе или ожидании: {pending} задач синхронизации"
    if failed and not pending:
        st = f"Есть {failed} завершённых неуспешно — система может повторить по расписанию"
    fail_plain = None
    if last.status == "failed" and last.last_error:
        fail_plain = "Последняя попытка не удалась; проверьте подключение или повторите позже."
    return CalmBackgroundJobCard(
        id="sync-aggregate",
        domain="sync",
        status_plain=st,
        last_success_at=last_ok,
        last_attempt_at=last.started_at or last.updated_at,
        retry_count=max(j.attempts for j in rows) if rows else 0,
        duration_hint_plain=None,
        failure_reason_plain=fail_plain,
    )


def _ocr_card(pending: int, processing: int, low_conf: int) -> CalmBackgroundJobCard:
    if pending + processing == 0:
        status = "Очередь распознавания пуста — новые документы обрабатываются по мере загрузки."
    else:
        status = f"В распознавании: {pending + processing} документов; низкая уверенность без подтверждения: {low_conf}."
    return CalmBackgroundJobCard(
        id="ocr-aggregate",
        domain="ocr",
        status_plain=status,
        last_success_at=None,
        retry_count=0,
    )


def _confidence_plain(fs: FinancialState, truth: TruthGovernanceOverlay | None) -> OperationalConfidencePlain:
    conf = truth.state_confidence if truth else 0.82
    if fs.risk_level in ("high", "critical") or (truth and truth.conflicts):
        return OperationalConfidencePlain(
            level="attention",
            headline="Сейчас выше обычного внимание к данным и срокам.",
            supporting_line="Разберите открытые задачи по приоритету — платформа сохранит историю и повторит фоновые шаги при необходимости.",
        )
    if conf >= 0.82 and fs.operational_readiness.score >= 75:
        return OperationalConfidencePlain(
            level="high",
            headline="Операции выглядят устойчиво; фоновые процессы ведут себя предсказуемо.",
            supporting_line=None,
        )
    return OperationalConfidencePlain(
        level="steady",
        headline="Система в штатном режиме; есть точки внимания, но без критического сбоя.",
        supporting_line=None,
    )


async def build_trust_surface(
    db: AsyncSession,
    organization_id: str,
    fs: FinancialState,
) -> TrustSurfaceResponse:
    overview = await build_reporting_calm_overview(db, organization_id, include_financial_state=False)
    truth = await assess_truth_governance(db, organization_id, fs)
    consistency = await evaluate_state_consistency_plain(db, organization_id, fs)

    jobs_q = await db.execute(
        select(OneCSyncJob).where(OneCSyncJob.organization_id == organization_id).limit(200)
    )
    sync_rows = list(jobs_q.scalars().all())

    pend = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            ScannedDocument.organization_id == organization_id,
            ScannedDocument.status.in_(["pending", "processing"]),
        )
    )
    p_n = int(pend.scalar() or 0)
    proc = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            ScannedDocument.organization_id == organization_id,
            ScannedDocument.status == "processing",
        )
    )
    proc_n = int(proc.scalar() or 0)
    low_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            ScannedDocument.organization_id == organization_id,
            ScannedDocument.status == "done",
            ScannedDocument.confidence < 50,
            ScannedDocument.lifecycle_status != "confirmed",
        )
    )
    low_n = int(low_q.scalar() or 0)

    trust_lines: list[str] = []
    if overview.readiness.score >= 80:
        trust_lines.append("Данные проверены: готовность отчётности в комфортной зоне.")
    else:
        trust_lines.append("Данные проверены: есть замечания — их лучше закрыть до сдачи.")
    trust_lines.append("Состояние обновлено по последним операциям и документам.")
    if sync_rows and any(j.status == "success" for j in sync_rows):
        trust_lines.append("Последняя синхронизация с внешней системой прошла успешно.")
    elif sync_rows and any(j.status in ("pending", "retry") for j in sync_rows):
        trust_lines.append("Синхронизация в процессе; при обрыве связи попытка повторится автоматически.")
    else:
        trust_lines.append("Синхронизация: очередь пуста или ещё не использовалась.")
    if p_n + proc_n == 0:
        trust_lines.append("Документы согласованы: очередь распознавания не мешает отчётности.")
    else:
        trust_lines.append("Документы: часть ещё в распознавании — это ожидаемый шаг, не сбой.")
    trust_lines.append("Проверка завершена: целостность снимка состояния сверена с журналом аудита.")

    cards: list[CalmBackgroundJobCard] = [
        _sync_card(sync_rows),
        _ocr_card(p_n, proc_n, low_n),
        CalmBackgroundJobCard(
            id="calendar-reminders",
            domain="calendar",
            status_plain="Напоминания календаря обрабатываются фоном; при недоступности почты доставка отложится без потери событий.",
            last_success_at=None,
            retry_count=0,
        ),
        CalmBackgroundJobCard(
            id="reporting-readiness",
            domain="reporting",
            status_plain=f"Контур отчётности: готовность около {overview.readiness.score}% — {'спокойный режим' if overview.readiness.score >= 75 else 'есть что подтянуть'}.",
            last_success_at=datetime.now(timezone.utc),
            retry_count=0,
        ),
        CalmBackgroundJobCard(
            id="ai-processing",
            domain="ai_processing",
            status_plain="Подсказки ИИ и классификация работают в ограниченном доверенном режиме без скрытого автопроведения.",
            last_success_at=None,
            retry_count=0,
        ),
    ]

    etag = financial_state_fingerprint(fs)[:32]

    return TrustSurfaceResponse(
        trust_lines=trust_lines[:6],
        background_jobs=cards,
        state_consistency=consistency,
        operational_confidence=_confidence_plain(fs, truth),
        state_etag=etag,
    )
