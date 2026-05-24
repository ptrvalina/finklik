import { memo } from 'react'
import { executionCtaLabel } from '../../lib/executionPresentation'

export type WorkPackLike = {
  id: string
  title: string
  recommended_action: string
  expected_outcome: string
  risk_if_ignored: string
  primary_action_path: string | null
  summary_lines: Array<{ kind: string; count: number; detail?: string | null }>
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

  return (
    <article className="fc-execution-card rounded-2xl border border-outline/35 bg-surface/90 p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Пакет работ</p>
      <h3 className="mt-1 font-headline text-base font-semibold text-on-surface">{pack.title}</h3>
      {summary && <p className="mt-1 text-xs text-on-surface-variant">{summary}</p>}
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
