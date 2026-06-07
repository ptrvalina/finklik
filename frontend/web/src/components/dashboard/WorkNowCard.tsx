import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { executionCtaLabel } from '../../lib/executionPresentation'

/** Одна главная задача — единственный primary CTA на главной. */
export default function WorkNowCard() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: orgQueryKey('execution-feed-preview'),
    queryFn: () => operationsApi.executionFeed().then((r) => r.data),
    staleTime: 45_000,
    retry: 1,
  })

  const items: any[] = data?.items ?? []
  const top = data?.top_action ?? items[0]

  if (isLoading) {
    return <div className="fc-skeleton-pulse h-24 rounded-xl" />
  }

  if (isError) {
    return (
      <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Следующее действие</p>
        <p className="mt-2 text-sm text-on-surface-variant">Не удалось загрузить задачу.</p>
        <Link to="/inbox" className="btn-primary mt-3 inline-flex min-h-9 text-sm">
          Открыть очередь
        </Link>
      </section>
    )
  }

  if (!top) {
    return (
      <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Следующее действие</p>
        <p className="mt-2 text-sm text-on-surface-variant">Срочных задач нет — можно загрузить документ или проверить очередь позже.</p>
        <Link to="/scan" className="btn-primary mt-3 inline-flex min-h-9 text-sm">
          Открыть сканер
        </Link>
      </section>
    )
  }

  const go = () => navigate(top.action_path || '/operations')

  return (
    <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Следующее действие</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-headline text-base font-bold leading-snug text-on-surface sm:text-lg">{top.title}</h3>
          {(top.context || top.ai_why) && (
            <p className="mt-1 text-sm text-on-surface-variant">{top.context || top.ai_why}</p>
          )}
        </div>
        <button type="button" className="btn-primary fc-btn-thumb shrink-0 self-start text-sm" onClick={go}>
          {executionCtaLabel(top.type)}
        </button>
      </div>
    </section>
  )
}
