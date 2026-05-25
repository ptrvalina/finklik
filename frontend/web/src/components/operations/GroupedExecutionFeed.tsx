import { memo } from 'react'
import { ExecutionTaskCard } from '../execution/ExecutionTaskCard'
import { groupOperationsOrdered, operationTypeLabel } from '../../lib/executionLabels'
import type { OperationalItem } from './GroupedExecutionFeed.types'

export type { OperationalItem } from './GroupedExecutionFeed.types'

function GroupedExecutionFeed({
  top,
  rest,
  compact,
  onOpen,
  onInspect,
}: {
  top: OperationalItem | null
  rest: OperationalItem[]
  compact?: boolean
  onOpen: (path: string | null | undefined) => void
  onInspect?: (item: OperationalItem) => void
}) {
  const groups = groupOperationsOrdered(rest)

  return (
    <div className="fc-section-stack">
      {top && (
        <section>
          <p className="fc-section-label mb-3">Следующий шаг</p>
          <ExecutionTaskCard item={top} prominent onOpen={onOpen} onInspect={onInspect} />
        </section>
      )}

      {groups.map(({ type, items: groupItems }) => (
        <section key={type}>
          <p className="fc-section-label mb-3">{operationTypeLabel(type)}</p>
          <div className="space-y-3">
            {groupItems.map((item) => (
              <ExecutionTaskCard
                key={item.id}
                item={item}
                compact={compact}
                onOpen={onOpen}
                onInspect={onInspect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default memo(GroupedExecutionFeed)
