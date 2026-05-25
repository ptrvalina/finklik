"""Группировка операционных пунктов в Work Pack с режимом автономности (Flow 5)."""

from __future__ import annotations

from app.schemas.financial_state import (
    AIActionMode,
    FinancialState,
    StateDimension,
    WorkPack,
    WorkPackLine,
)
from app.schemas.operations_feed import OperationalItem

_PRI: dict[str, int] = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def infer_state_dimension(item: OperationalItem) -> StateDimension:
    if item.id == "readiness-gate":
        return "operational_readiness"
    if item.type == "reconciliation":
        return "document_completeness"
    if item.type == "transaction":
        return "cashflow_state"
    if item.type == "document":
        return "document_completeness"
    if item.type == "approval":
        return "compliance_state"
    if item.type == "reporting":
        return "reporting_status"
    return "operational_readiness"


def _mode_for_pack(n_items: int, has_critical: bool, fs: FinancialState) -> AIActionMode:
    if fs.risk_level == "critical" or has_critical:
        return "execute_with_approval"
    if n_items >= 4:
        return "prepare"
    if n_items >= 2:
        return "suggest"
    return "observe"


def build_work_packs(items: list[OperationalItem], fs: FinancialState) -> list[WorkPack]:
    """Детерминированная кластеризация без новых сущностей в БД."""

    journal_ids: list[str] = []
    doc_ids: list[str] = []
    comp_ids: list[str] = []
    rep_ids: list[str] = []

    for it in items:
        dim = infer_state_dimension(it)
        if dim in ("cashflow_state", "operational_readiness"):
            journal_ids.append(it.id)
        elif dim == "document_completeness":
            doc_ids.append(it.id)
        elif dim == "compliance_state":
            comp_ids.append(it.id)
        elif dim == "reporting_status":
            rep_ids.append(it.id)

    packs: list[WorkPack] = []

    def crit_subset(ids: list[str]) -> bool:
        return any(x.priority == "critical" for x in items if x.id in ids)

    if journal_ids:
        sub = [x for x in items if x.id in journal_ids]
        lines = _lines_from_items(sub)
        mode = _mode_for_pack(len(sub), crit_subset(journal_ids), fs)
        packs.append(
            WorkPack(
                id="pack-journal-readiness",
                title="Учёт и готовность данных",
                mode=mode,
                summary_lines=lines,
                operational_item_ids=journal_ids,
                recommended_action="Откройте журнал и устраните черновики, категории и дубликаты — состояние готовности обновится автоматически.",
                expected_outcome=f"Рост operational readiness и reporting_status при сохранении текущего cashflow_state ({fs.cashflow_state.level}).",
                risk_if_ignored="Готовность отчётности останется ниже порога; возможны задержки сдачи и пересмотр расходов.",
                primary_action_path="/accounting",
            )
        )

    if doc_ids:
        sub = [x for x in items if x.id in doc_ids]
        lines = _lines_from_items(sub)
        mode = _mode_for_pack(len(sub), crit_subset(doc_ids), fs)
        packs.append(
            WorkPack(
                id="pack-documents-reconciliation",
                title="Документы и сверка",
                mode=mode,
                summary_lines=lines,
                operational_item_ids=doc_ids,
                recommended_action="Подтвердите OCR, свяжите документы с операциями и закройте предложения сверки.",
                expected_outcome=f"Рост document_completeness (сейчас {fs.document_completeness.score}%) и снижение compliance рисков.",
                risk_if_ignored="Разрыв между выпиской и первичкой сохранится — выше внимание контролирующих органов.",
                primary_action_path="/scan",
            )
        )

    if comp_ids:
        sub = [x for x in items if x.id in comp_ids]
        lines = _lines_from_items(sub)
        mode = _mode_for_pack(len(sub), crit_subset(comp_ids), fs)
        packs.append(
            WorkPack(
                id="pack-compliance",
                title="Согласования и входящие",
                mode=mode,
                summary_lines=lines,
                operational_item_ids=comp_ids,
                recommended_action="Разберите очередь согласований и ответов по входящим запросам.",
                expected_outcome=f"Переход compliance_state к «clear» при текущих {fs.compliance_state.pending_approvals} ожидающих согласований.",
                risk_if_ignored="Блокировка проведения и закрытия периода до ответа ответственных лиц.",
                primary_action_path="/workspace",
            )
        )

    if rep_ids:
        sub = [x for x in items if x.id in rep_ids]
        lines = _lines_from_items(sub)
        mode = _mode_for_pack(len(sub), crit_subset(rep_ids), fs)
        packs.append(
            WorkPack(
                id="pack-reporting-deadlines",
                title="Отчётность и дедлайны",
                mode=mode,
                summary_lines=lines,
                operational_item_ids=rep_ids,
                recommended_action="Закройте регламентные шаги в отчётности и календаре.",
                expected_outcome=f"Стабилизация reporting_status (сейчас «{fs.reporting_status.status}»).",
                risk_if_ignored="Пропуск сроков и штрафы; деградация operational_readiness.",
                primary_action_path="/reports",
            )
        )

    nonempty = [p for p in packs if p.operational_item_ids]
    if nonempty:
        return sort_work_packs_by_urgency(nonempty, items)

    return [
        WorkPack(
            id="pack-baseline-coherence",
            title="Операционная целостность",
            mode="observe",
            summary_lines=[
                WorkPackLine(
                    kind="mixed",
                    count=0,
                    detail="Активных очередей без решения не выявлено — удерживайте журнал, сканы и отчётность в актуальном состоянии.",
                )
            ],
            operational_item_ids=[],
            recommended_action="Периодически проверяйте журнал и ленту исполнения.",
            expected_outcome="Сохранение текущего уровня operational readiness и reporting readiness.",
            risk_if_ignored="Постепенное накопление мелких расхождений без внимания.",
            primary_action_path="/operations",
        )
    ]


def enrich_work_packs(
    packs: list[WorkPack],
    items: list[OperationalItem],
    acknowledged_pack_ids: set[str],
) -> list[WorkPack]:
    """Добавляет progress_pct / blocked_reason из текущей ленты и факта ack."""

    idx = {it.id: it for it in items}
    enriched: list[WorkPack] = []
    for pack in packs:
        ids = pack.operational_item_ids
        if not ids:
            enriched.append(
                pack.model_copy(
                    update={"progress_pct": 100 if pack.id in acknowledged_pack_ids else 8, "acknowledged": pack.id in acknowledged_pack_ids},
                )
            )
            continue
        remaining = [oid for oid in ids if oid in idx]
        total = len(ids)
        done = total - len(remaining)
        base_pct = round(100 * done / total) if total else 0
        acked = pack.id in acknowledged_pack_ids
        progress_pct = min(100, base_pct + (18 if acked else 0))
        if progress_pct < 6:
            progress_pct = 6
        crit_left = sum(1 for oid in remaining if idx.get(oid) and idx[oid].priority == "critical")
        blocked_reason: str | None = None
        if crit_left:
            blocked_reason = f"Остаётся {crit_left} критичных шагов в ленте"
        elif remaining:
            blocked_reason = f"Остаётся {len(remaining)} из {total} шагов"
        enriched.append(
            pack.model_copy(
                update={
                    "progress_pct": progress_pct,
                    "blocked_reason": blocked_reason,
                    "acknowledged": acked,
                },
            )
        )
    return enriched


def sort_work_packs_by_urgency(packs: list[WorkPack], items: list[OperationalItem]) -> list[WorkPack]:
    idx = {it.id: it for it in items}

    def score(p: WorkPack) -> int:
        s = 0
        for oid in p.operational_item_ids:
            it = idx.get(oid)
            if not it:
                continue
            s = max(s, _PRI.get(it.priority, 0))
        return s

    return sorted(packs, key=score, reverse=True)


def _lines_from_items(sub: list[OperationalItem]) -> list[WorkPackLine]:
    by_type: dict[str, int] = {}
    for it in sub:
        by_type[it.type] = by_type.get(it.type, 0) + 1
    labels = {
        "transaction": "операций учёта",
        "document": "задач по документам",
        "approval": "согласований",
        "reporting": "пунктов отчётности",
        "reconciliation": "сверок",
    }
    lines: list[WorkPackLine] = []
    for k, n in sorted(by_type.items(), key=lambda x: -x[1]):
        lines.append(WorkPackLine(kind=k, count=n, detail=labels.get(k, k)))
    return lines or [WorkPackLine(kind="mixed", count=len(sub), detail="операционных сигналов")]
