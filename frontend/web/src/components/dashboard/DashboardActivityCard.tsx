import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { eventsApi, dashboardApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { domainEventToActivityLabel, formatActivityWhen } from '../../lib/domainEventLabels'

type Tx = {
  id: string
  type?: string
  description?: string
  transaction_date?: string
  amount?: number | string
  status?: string
  source?: string
}

function txToActivity(tx: Tx): { id: string; title: string; when: string } {
  if (tx.source === 'bank') return { id: tx.id, title: 'Импортирована выписка', when: tx.transaction_date ?? '' }
  if (tx.source === 'scan') return { id: tx.id, title: 'Загружен документ', when: tx.transaction_date ?? '' }
  if (tx.status === 'draft') return { id: tx.id, title: 'Загружен документ', when: tx.transaction_date ?? '' }
  if (tx.type === 'income') return { id: tx.id, title: 'Проведена операция', when: tx.transaction_date ?? '' }
  return { id: tx.id, title: 'Проведена операция', when: tx.transaction_date ?? '' }
}

export default function DashboardActivityCard() {
  const { data: events, isLoading: evLoading } = useQuery({
    queryKey: orgQueryKey(['domain-events-recent']),
    queryFn: () => eventsApi.recent({ limit: 8 }).then((r) => r.data),
    staleTime: 45_000,
    retry: false,
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: orgQueryKey(['transactions', 'recent-home']),
    queryFn: () => dashboardApi.getTransactions({ per_page: 8 }).then((r) => r.data),
    staleTime: 45_000,
    enabled: !events?.length,
  })

  const isLoading = evLoading || (txLoading && !events?.length)

  const items = (() => {
    if (events?.length) {
      return events.slice(0, 5).map((ev: { id: string; event_type: string; payload?: Record<string, unknown>; occurred_at_ms?: number }) => {
        const { title } = domainEventToActivityLabel(ev)
        return { id: ev.id, title, when: formatActivityWhen(ev.occurred_at_ms) }
      })
    }
    return (txData?.items ?? []).slice(0, 5).map(txToActivity)
  })()

  return (
    <article className="fc-dashboard-card flex flex-col">
      <h2 className="fc-dashboard-card-title">Последние события</h2>

      {isLoading ? (
        <div className="fc-skeleton-pulse mt-2 min-h-[100px] flex-1 rounded-lg" />
      ) : items.length === 0 ? (
        <p className="mt-3 flex-1 text-sm text-on-surface-variant">Событий пока нет</p>
      ) : (
        <ul className="mt-2 flex-1 space-y-2 overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-lg text-on-surface-variant/60" aria-hidden>
                history
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">{item.title}</p>
                {item.when ? <p className="text-xs text-on-surface-variant">{item.when}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link to="/accounting/journal" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
        Журнал →
      </Link>
    </article>
  )
}
