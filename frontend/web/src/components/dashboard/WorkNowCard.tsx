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
    return <div className="fc-skeleton-pulse h-28 rounded-2xl" />
  }

  if (isError) {
    return (
      <section className="fc-wow-card rounded-2xl border border-outline/30 bg-surface p-4">
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
      <section className="fc-wow-card relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-surface to-emerald-500/[0.06] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Свободно для работы</p>
        <p className="mt-2 font-headline text-base font-bold text-on-surface">Очередь чистая</p>
        <p className="mt-1 text-sm text-on-surface-variant">Загрузите документ — ФинКлик подставит реквизиты, вы подтвердите в журнал.</p>
        <Link to="/scan" className="btn-primary mt-4 inline-flex min-h-10 text-sm shadow-[0_8px_24px_-8px_rgba(0,88,190,0.45)]">
          Открыть сканер
        </Link>
      </section>
    )
  }

  const go = () => navigate(top.action_path || '/operations')

  return (
    <section className="fc-wow-card fc-wow-card--pulse relative overflow-hidden rounded-2xl border border-primary/30 bg-surface p-4 shadow-[0_12px_40px_-20px_rgba(0,88,190,0.28)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Сделать сейчас</p>
      <div className="relative z-[1] mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-headline text-base font-bold leading-snug text-on-surface sm:text-lg">{top.title}</h3>
          {(top.context || top.ai_why) && (
            <p className="mt-1 text-sm text-on-surface-variant">{top.context || top.ai_why}</p>
          )}
        </div>
        <button
          type="button"
          className="btn-primary fc-btn-thumb shrink-0 self-start text-sm shadow-[0_8px_28px_-10px_rgba(0,88,190,0.55)] transition hover:-translate-y-0.5"
          onClick={go}
        >
          {executionCtaLabel(top.type)}
        </button>
      </div>
    </section>
  )
}
