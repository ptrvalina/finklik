import { memo, useCallback, useRef } from 'react'
import { GlassCard } from '../premium/GlassCard'
import {
  groupOperationsByType,
  operationPriorityLabel,
  operationTypeLabel,
} from '../../lib/executionLabels'

export type OperationalItem = {
  id: string
  type: string
  priority: string
  status?: string
  entity_id?: string
  title: string
  context?: string | null
  action_path?: string | null
  ai_why?: string | null
  state_dimension?: string | null
  state_transition_hint?: string | null
}

function priorityStyles(p: string) {
  switch (p) {
    case 'critical':
      return 'bg-red-500/15 text-red-700 ring-red-400/30 dark:text-red-200'
    case 'high':
      return 'bg-amber-500/12 text-amber-800 ring-amber-400/25 dark:text-amber-100'
    default:
      return 'bg-surface-container-high text-on-surface-variant ring-outline/30'
  }
}

function typeIcon(t: string) {
  switch (t) {
    case 'transaction':
      return 'menu_book'
    case 'document':
      return 'document_scanner'
    case 'approval':
      return 'verified_user'
    case 'reporting':
      return 'assignment_turned_in'
    case 'reconciliation':
      return 'compare_arrows'
    default:
      return 'task_alt'
  }
}

const FeedRow = memo(function FeedRow({
  item,
  onOpen,
  onInspect,
  prominent,
  compact,
}: {
  item: OperationalItem
  onOpen: (path: string | null | undefined) => void
  onInspect: (item: OperationalItem) => void
  prominent?: boolean
  compact?: boolean
}) {
  const touch = useRef({ x: 0, y: 0 })
  const go = useCallback(() => onOpen(item.action_path), [item.action_path, onOpen])

  return (
    <GlassCard
      variant="subtle"
      hoverLift={false}
      className={`p-3.5 sm:p-4 ${prominent ? 'ring-1 ring-primary/35' : ''}`}
      onClick={() => go()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0]
        if (t.clientX - touch.current.x > 70 && Math.abs(t.clientY - touch.current.y) < 40 && item.action_path) go()
      }}
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-primary/90">{typeIcon(item.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityStyles(item.priority)}`}
            >
              {operationPriorityLabel(item.priority)}
            </span>
            <span className="text-[10px] font-medium text-on-surface-variant">{operationTypeLabel(item.type)}</span>
          </div>
          <p className="mt-1 font-headline text-[15px] font-semibold leading-snug text-on-surface">{item.title}</p>
          {item.context && !compact && (
            <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{item.context}</p>
          )}
          {item.ai_why && !compact && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              <span className="font-medium text-on-surface/90">Зачем: </span>
              {item.ai_why}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {item.action_path && (
              <button type="button" className="btn-primary !min-h-9 !px-3 !py-1.5 text-xs" onClick={() => go()}>
                Открыть
              </button>
            )}
            <button type="button" className="btn-secondary !min-h-9 !px-3 !py-1.5 text-xs" onClick={() => onInspect(item)}>
              Подробнее
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  )
})

type Props = {
  top: OperationalItem | null
  rest: OperationalItem[]
  compact?: boolean
  onOpen: (path: string | null | undefined) => void
  onInspect: (item: OperationalItem) => void
}

export default function GroupedExecutionFeed({ top, rest, compact, onOpen, onInspect }: Props) {
  const groups = groupOperationsByType(rest)

  return (
    <div className="fc-section-stack-sm">
      {top && (
        <section>
          <h2 className="fc-section-label mb-3">Сделать в первую очередь</h2>
          <FeedRow item={top} onOpen={onOpen} onInspect={onInspect} prominent compact={compact} />
        </section>
      )}

      {Object.entries(groups).map(([type, items]) => (
        <section key={type}>
          <h2 className="fc-section-label mb-3">
            {operationTypeLabel(type)} <span className="font-normal text-on-surface-variant">({items.length})</span>
          </h2>
          <div className="grid gap-2.5">
            {items.map((item) => (
              <FeedRow key={item.id} item={item} onOpen={onOpen} onInspect={onInspect} compact={compact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
