import { memo } from 'react'
import { executionCtaLabel } from '../../lib/executionPresentation'

export type WorkPackLike = {
  id: string
  title: string
  mode?: string
  operational_item_ids?: string[]
  recommended_action: string
  expected_outcome: string
  risk_if_ignored: string
  primary_action_path: string | null
  summary_lines: Array<{ kind: string; count: number; detail?: string | null }>
  progress_pct?: number | null
  blocked_reason?: string | null
  acknowledged?: boolean
}

function packProgress(pack: WorkPackLike): { tasks: number; etaMin: number; progressPct: number } {
  const tasks = pack.operational_item_ids?.length ?? pack.summary_lines.reduce((s, ln) => s + ln.count, 0)
  const etaMin = Math.max(5, Math.min(45, tasks * 4))
  const progressPct =
    typeof pack.progress_pct === 'number'
      ? Math.min(100, Math.max(0, pack.progress_pct))
      : tasks > 0
        ? Math.min(100, Math.round((1 / (tasks + 1)) * 100))
        : 12
  return { tasks, etaMin, progressPct }
}

export const WorkPackCard = memo(function WorkPackCard({
  pack,
  onAck,
  onOpen,
  ackPending,
}: {
  pack: WorkPackLike
  onAck: () => void
  onOpen: (path: string | null | undefined) => void
  ackPending?: boolean
}) {
  const summary = pack.summary_lines.map((ln) => `${ln.count} × ${ln.detail || ln.kind}`).join(' · ')
  const { tasks, etaMin, progressPct } = packProgress(pack)

  return (
    <article className="fc-execution-card rounded-2xl border border-outline/35 bg-surface/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Пакет работ</p>
        <p className="text-[10px] font-semibold text-on-surface-variant">
          ~{etaMin} мин · {tasks} {tasks === 1 ? 'шаг' : tasks < 5 ? 'шага' : 'шагов'}
        </p>
      </div>
      <h3 className="mt-1 font-headline text-base font-semibold text-on-surface">{pack.title}</h3>
      {summary && <p className="mt-1 text-xs text-on-surface-variant">{summary}</p>}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-on-surface-variant">
          <span>Прогресс пакета</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        {pack.blocked_reason && (
          <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-200">{pack.blocked_reason}</p>
        )}
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-emerald-400/80 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <p className="mt-3 text-sm text-on-surface">{pack.recommended_action}</p>
      <p className="mt-2 text-xs text-on-surface-variant">{pack.expected_outcome}</p>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-semibold">Если отложить: </span>
        {pack.risk_if_ignored}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary min-h-11 rounded-xl px-4 text-sm"
          onClick={() => onOpen(pack.primary_action_path)}
        >
          {executionCtaLabel('reporting')}
        </button>
        <button type="button" className="btn-secondary min-h-11 text-sm" disabled={ackPending} onClick={onAck}>
          {ackPending ? '…' : 'Принять к работе'}
        </button>
      </div>
    </article>
  )
})
