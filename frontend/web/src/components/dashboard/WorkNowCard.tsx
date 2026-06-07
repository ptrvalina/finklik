import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { executionCtaLabel } from '../../lib/executionPresentation'

/** Одна главная задача — без превью «Далее». */
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
    return <div className="fc-skeleton-pulse h-44 rounded-2xl" />
  }

  if (isError) {
    return (
      <section className="glass-card rounded-2xl p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Следующий шаг</p>
        <p className="mt-2 text-sm text-on-surface-variant">Не удалось загрузить задачи. Проверьте связь и откройте очередь.</p>
        <Link to="/inbox" className="btn-primary mt-4 inline-flex min-h-10 text-sm">
          Очередь
        </Link>
      </section>
    )
  }

  if (!top) {
    return (
      <section className="glass-card rounded-2xl p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Следующий шаг</p>
        <p className="mt-2 text-sm text-on-surface-variant">Срочных задач нет — можно проверить очередь или загрузить документ.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/scan" className="btn-primary inline-flex min-h-10 text-sm">
            Сканер
          </Link>
          <Link to="/inbox" className="btn-secondary inline-flex min-h-10 text-sm">
            Очередь
          </Link>
        </div>
      </section>
    )
  }

  const go = () => navigate(top.action_path || '/operations')

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Следующий шаг</p>
      <div
        className="group mt-4 cursor-pointer rounded-2xl border border-primary/20 bg-primary/5 p-5 transition hover:border-primary/40 hover:bg-primary/10 sm:p-6"
        onClick={go}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            go()
          }
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-headline text-lg font-bold leading-tight text-on-surface sm:text-xl">{top.title}</h3>
            {(top.context || top.ai_why) && (
              <p className="mt-2 text-sm text-on-surface-variant">{top.context || top.ai_why}</p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition group-hover:gap-3">
            {executionCtaLabel(top.type)}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </section>
  )
}
