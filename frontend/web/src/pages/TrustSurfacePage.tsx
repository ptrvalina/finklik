import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import { jobDomainLabel } from '../i18n/apiLabels.ru'
import { terminology } from '../i18n/terminology.ru'

type TrustSurfaceResponse = {
  trust_lines: string[]
  background_jobs: Array<{ id: string; domain: string; status_plain: string; failure_reason_plain?: string | null }>
  state_consistency?: { message_plain: string; stale_hint_plain?: string | null }
  operational_confidence: { headline: string; supporting_line?: string | null }
  safe_actions: {
    confirmation_hint: string
    audit_reference_hint: string
    undo_window_hint: string
    rollback_hint: string
  }
}

export default function TrustSurfacePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('trust-surface'),
    queryFn: () => operationsApi.trustSurface().then((r) => r.data as TrustSurfaceResponse),
    staleTime: 60_000,
    retry: 1,
  })

  const t = terminology
  const failedJobs = data?.background_jobs.filter((j) => j.failure_reason_plain).length ?? 0
  const activeJobs = data?.background_jobs.length ?? 0

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to="/control/state" className="btn-secondary fc-btn-thumb text-sm">
          {t.execution.financialStateShort}
        </Link>
        <Link to="/operations?trust=1" className="btn-primary fc-btn-thumb text-sm">
          Лента работы
        </Link>
      </div>

      {!isLoading && !isError && data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Индикаторы</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
              {data.trust_lines.length}
            </p>
            <p className="text-[11px] text-primary">Спокойные сигналы</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Фоновые задачи</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{activeJobs}</p>
            <p className="text-[11px] text-on-surface-variant">Процессов</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Ошибки</p>
            <p className={`mt-1 font-headline text-xl font-extrabold tabular-nums sm:text-2xl ${failedJobs > 0 ? 'text-error' : 'text-primary'}`}>
              {failedJobs}
            </p>
            <p className="text-[11px] text-on-surface-variant">Требуют внимания</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Уверенность</p>
            <p className="mt-1 line-clamp-2 font-headline text-sm font-extrabold text-on-surface sm:text-base">
              {data.operational_confidence.headline}
            </p>
            <p className="text-[11px] text-on-surface-variant">Операционная</p>
          </div>
        </div>
      )}

      {isLoading && <CardSkeleton className="min-h-[200px]" />}
      {isError && (
        <CalmErrorState
          title={t.trust.loadTitle}
          fallbackMessage={t.trust.loadFallback}
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !isError && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-card rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{t.trust.calmIndicators}</p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-on-surface-variant">
              {data.trust_lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <section className="glass-card rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{t.trust.backgroundJobs}</p>
            <ul className="mt-3 space-y-3 text-sm">
              {data.background_jobs.map((j) => (
                <li key={j.id} className="text-on-surface-variant">
                  <span className="font-medium text-on-surface">{jobDomainLabel(j.domain)}</span> — {j.status_plain}
                  {j.failure_reason_plain ? (
                    <span className="mt-1 block text-amber-800 dark:text-amber-200">{j.failure_reason_plain}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          {data.state_consistency && (
            <p className="glass-card rounded-2xl px-4 py-3 text-sm text-on-surface-variant lg:col-span-2">
              <span className="font-medium text-on-surface">{t.trust.consistency}: </span>
              {data.state_consistency.message_plain}
              {data.state_consistency.stale_hint_plain ? ` ${data.state_consistency.stale_hint_plain}` : ''}
            </p>
          )}
          <section className="glass-card rounded-2xl p-5">
            <p className="font-medium text-on-surface">{data.operational_confidence.headline}</p>
            {data.operational_confidence.supporting_line && (
              <p className="mt-2 text-sm text-on-surface-variant">{data.operational_confidence.supporting_line}</p>
            )}
          </section>
          <section className="glass-card rounded-2xl border-primary/20 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{t.trust.safeActions}</p>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
              <li>{data.safe_actions.confirmation_hint}</li>
              <li>{data.safe_actions.audit_reference_hint}</li>
              <li>{data.safe_actions.undo_window_hint}</li>
              <li>{data.safe_actions.rollback_hint}</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
