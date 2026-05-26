import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  FLOW_STEP_META,
  buildReportingPeriodNarrative,
  suggestedFlowStepIndex,
  type CalmOverviewLike,
  type FlowStepId,
} from './reportingFlowModel'

const PHASE_TONE: Record<string, string> = {
  accumulating: 'fc-surface-calm',
  closing: 'fc-surface-calm fc-execution-card--tone-pending',
  deadline_pressure: 'fc-surface-calm fc-priority-row--amber',
  ready_for_draft: 'fc-surface-calm fc-surface-calm--ok',
  monitoring: 'fc-surface-calm fc-execution-card--tone-ok',
}

const STATE_RU: Record<string, string> = {
  draft: 'Черновик',
  preparing: 'В работе',
  ready: 'К проверке',
  needs_attention: 'Контроль',
  submitted: 'Сдано',
  overdue: 'Просрочено',
}

type Props = {
  data: CalmOverviewLike | undefined
  onGoToStep?: (index: number) => void
  compact?: boolean
}

export default function ReportingPeriodNarrative({ data, onGoToStep, compact }: Props) {
  const narrative = useMemo(() => buildReportingPeriodNarrative(data), [data])

  return (
    <section
      aria-label="Отчётный период"
      className={`p-4 sm:p-5 ${PHASE_TONE[narrative.phase] ?? PHASE_TONE.accumulating}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Отчётный период · {narrative.periodLabel}
          </p>
          <p className="mt-2 font-headline text-base font-semibold text-on-surface sm:text-lg">{narrative.headline}</p>
          {!compact && (
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{narrative.supporting}</p>
          )}
        </div>
        <span className="shrink-0 self-start rounded-full border border-outline/40 bg-surface-container-high px-3 py-1 text-[11px] font-bold text-on-surface">
          {narrative.phaseLabel}
        </span>
      </div>

      {!compact && narrative.milestones.length > 0 && (
        <div className="mt-4 border-t border-outline/20 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Сроки в {narrative.periodLabel}
          </p>
          <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto text-sm">
            {narrative.milestones.map((m) => (
              <li key={`${m.date}-${m.title}`} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-on-surface">{m.title}</span>
                <span className="shrink-0 text-xs text-on-surface-variant tabular-nums">
                  {m.date}
                  {m.state ? ` · ${STATE_RU[m.state] ?? m.state}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {onGoToStep ? (
          <button
            type="button"
            className="btn-primary min-h-10 text-xs"
            onClick={() => onGoToStep(suggestedFlowStepIndex(narrative.suggestedStepId))}
          >
            К шагу «{stepShortLabel(narrative.suggestedStepId)}»
          </button>
        ) : null}
        <Link to="/calendar" className="btn-secondary min-h-10 text-xs">
          Календарь
        </Link>
      </div>
    </section>
  )
}

function stepShortLabel(id: FlowStepId): string {
  return FLOW_STEP_META.find((m) => m.id === id)?.shortLabel ?? id
}
