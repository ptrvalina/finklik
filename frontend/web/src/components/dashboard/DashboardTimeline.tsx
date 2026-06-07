import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { eventsApi, dashboardApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { formatMoneyAmount } from '../../lib/formatMoney'
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

function txToActivity(tx: Tx): { id: string; title: string; detail?: string; when: string } {
  const amount = tx.amount != null ? formatMoneyAmount(tx.amount) : undefined
  if (tx.source === 'bank') {
    return {
      id: tx.id,
      title: 'Импортирована выписка',
      detail: tx.description ?? amount,
      when: tx.transaction_date ?? '',
    }
  }
  if (tx.source === 'scan' || tx.status === 'draft') {
    return {
      id: tx.id,
      title: tx.status === 'draft' ? 'Документ ждёт проведения' : 'Распознан документ',
      detail: tx.description ?? amount,
      when: tx.transaction_date ?? '',
    }
  }
  if (tx.type === 'income') {
    return {
      id: tx.id,
      title: 'Проведено поступление',
      detail: tx.description ?? amount,
      when: tx.transaction_date ?? '',
    }
  }
  return {
    id: tx.id,
    title: 'Проведён расход',
    detail: tx.description ?? amount,
    when: tx.transaction_date ?? '',
  }
}

/** Последние действия пользователя и системы — до 10 записей. */
export default function DashboardTimeline() {
  const { data: events, isLoading: evLoading } = useQuery({
    queryKey: orgQueryKey(['domain-events-recent']),
    queryFn: () => eventsApi.recent({ limit: 10 }).then((r) => r.data),
    staleTime: 45_000,
    retry: false,
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: orgQueryKey(['transactions', 'recent-home']),
    queryFn: () => dashboardApi.getTransactions({ per_page: 10 }).then((r) => r.data),
    staleTime: 45_000,
    enabled: !events?.length,
  })

  const isLoading = evLoading || (txLoading && !events?.length)

  const items = (() => {
    if (events?.length) {
      return events.slice(0, 10).map((ev: { id: string; event_type: string; payload?: Record<string, unknown>; occurred_at_ms?: number }) => {
        const { title, detail } = domainEventToActivityLabel(ev)
        return {
          id: ev.id,
          title,
          detail,
          when: formatActivityWhen(ev.occurred_at_ms),
        }
      })
    }
    return (txData?.items ?? []).slice(0, 10).map(txToActivity)
  })()

  return (
    <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Последние события</p>
        <Link to="/accounting/journal" className="text-xs font-semibold text-primary hover:underline">
          Журнал
        </Link>
      </div>

      {isLoading ? (
        <div className="fc-skeleton-pulse h-20 rounded-lg" />
      ) : items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Событий пока нет. Добавьте операцию или отсканируйте документ.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-lg px-1 py-1">
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-lg text-on-surface-variant/70" aria-hidden>
                history
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                {(item.detail || item.when) && (
                  <p className="text-xs text-on-surface-variant">
                    {[item.when, item.detail].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
