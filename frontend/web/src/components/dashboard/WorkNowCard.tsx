import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { executionCtaLabel } from '../../lib/executionPresentation'

/** Stitch «Срочные задачи» — тёмная карточка с главным действием и превью «Далее». */
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
  const next = items.find((i) => i?.id !== top?.id)
  const activeCount = items.length

  if (isLoading) {
    return <div className="fc-skeleton-pulse h-44 rounded-2xl" />
  }

  if (isError || !top) {
    return (
      <div className="fc-execution-card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Сейчас</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Открытых критичных задач нет — проверьте ленту или добавьте операции.
        </p>
        <Link to="/operations" className="btn-secondary mt-4 inline-flex min-h-10 text-sm">
          Лента работы
        </Link>
      </div>
    )
  }

  const go = () => navigate(top.action_path || '/operations')

  return (
    <section className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Срочные задачи</h3>
        {activeCount > 0 && <span className="text-[11px] font-bold text-primary">{activeCount} активных</span>}
      </div>
      <div
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-primary-container bg-primary-container p-7 text-white transition-all duration-300 hover:shadow-[0_24px_64px_-24px_rgba(19,27,46,0.6)] sm:p-8"
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
        <div className="relative z-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md">
              <h4 className="font-headline text-xl font-bold leading-tight sm:text-2xl">{top.title}</h4>
              {(top.context || top.ai_why) && (
                <p className="mt-2 text-sm text-white/60">{top.context || top.ai_why}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-white px-5 py-2.5 font-bold text-primary-container transition-all group-hover:gap-4">
              {executionCtaLabel(top.type)}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </div>
          {next && (
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/40">Далее:</span>
                <span className="truncate text-xs font-medium text-white/80">{next.title}</span>
              </div>
              <Link
                to="/operations"
                onClick={(e) => e.stopPropagation()}
                className="material-symbols-outlined shrink-0 text-white/30 transition-colors hover:text-white/70"
                aria-label="Вся лента"
              >
                more_horiz
              </Link>
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" aria-hidden />
      </div>
    </section>
  )
}
