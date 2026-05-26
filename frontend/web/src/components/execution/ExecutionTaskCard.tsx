import { memo, useCallback, useRef } from 'react'
import {
  executionConfidenceLabel,
  executionConfidenceTone,
  executionCtaLabel,
  executionMetaLine,
  executionRiskIfIgnored,
  executionTimeHint,
  type ExecutionTaskLike,
} from '../../lib/executionPresentation'

function priorityRing(p: string) {
  switch (p) {
    case 'critical':
      return 'ring-rose-400/40 border-rose-400/25 bg-rose-500/[0.06]'
    case 'high':
      return 'ring-amber-400/30 border-amber-400/20 bg-amber-500/[0.05]'
    default:
      return 'ring-outline/35 border-outline/30 bg-surface/80'
  }
}

function typeIcon(t: string) {
  switch (t) {
    case 'transaction':
      return 'menu_book'
    case 'document':
      return 'document_scanner'
    case 'reporting':
      return 'assignment_turned_in'
    case 'reconciliation':
      return 'compare_arrows'
    case 'approval':
      return 'verified_user'
    default:
      return 'task_alt'
  }
}

export type ExecutionTaskCardProps = {
  item: ExecutionTaskLike
  prominent?: boolean
  compact?: boolean
  onOpen: (path: string | null | undefined) => void
  onInspect?: (item: ExecutionTaskLike) => void
}

export const ExecutionTaskCard = memo(function ExecutionTaskCard({
  item,
  prominent,
  compact,
  onOpen,
  onInspect,
}: ExecutionTaskCardProps) {
  const touch = useRef({ x: 0, y: 0 })
  const go = useCallback(() => onOpen(item.action_path), [item.action_path, onOpen])
  const risk = executionRiskIfIgnored(item.priority, item.type)
  const confLabel = executionConfidenceLabel(item.truth_confidence)
  const confTone = executionConfidenceTone(item.truth_confidence)

  return (
    <article
      className={`fc-execution-card p-4 transition-shadow hover:shadow-md sm:p-5 ${priorityRing(item.priority)} ${
        prominent ? 'fc-execution-card--hero ring-2 ring-primary/35' : ''
      }`}
      onClick={() => go()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
      role="button"
      tabIndex={0}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0]
        if (t.clientX - touch.current.x > 70 && Math.abs(t.clientY - touch.current.y) < 40 && item.action_path) go()
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="material-symbols-outlined mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary"
          aria-hidden
        >
          {typeIcon(item.type)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
            <span>{executionMetaLine(item)}</span>
            <span className="text-on-surface-variant/70">· {executionTimeHint(item.type, item.priority)}</span>
          </div>
          <h3 className="mt-1 font-headline text-base font-semibold leading-snug text-on-surface sm:text-lg">{item.title}</h3>
          {item.context && !compact && (
            <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{item.context}</p>
          )}
          {item.ai_why && !compact && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              <span className="font-semibold text-primary">Почему сейчас: </span>
              {item.ai_why}
            </p>
          )}
          {risk && !compact && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Если отложить: </span>
              {risk}
            </p>
          )}
          {item.state_transition_hint && !compact && (
            <p className="mt-2 text-[11px] text-on-surface-variant">{item.state_transition_hint}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn-primary min-h-11 rounded-xl px-4 text-sm"
              onClick={() => go()}
            >
              {executionCtaLabel(item.type)}
            </button>
            {onInspect && (
              <button type="button" className="btn-ghost min-h-11 text-xs" onClick={() => onInspect(item)}>
                Проверить детали
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
})
