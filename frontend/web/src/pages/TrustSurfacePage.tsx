import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import OperationalPage from '../components/shell/OperationalPage'
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

  return (
    <OperationalPage
      eyebrow="Контроль"
      title={t.execution.trustSurface}
      description="Спокойные индикаторы: фоновые процессы, согласованность данных и правила безопасных действий."
      primaryAction={
        <Link to="/control/state" className="btn-secondary fc-btn-thumb text-sm">
          {t.execution.financialStateShort}
        </Link>
      }
    >
      {isLoading && <CardSkeleton className="min-h-[200px]" />}
      {isError && (
        <CalmErrorState
          title={t.trust.loadTitle}
          fallbackMessage={t.trust.loadFallback}
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !isError && data && (
        <div className="fc-section-stack space-y-6">
          <section className="fc-surface-calm p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{t.trust.calmIndicators}</p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-on-surface-variant">
              {data.trust_lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <section className="fc-surface-calm p-5">
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
            <p className="fc-surface-calm px-4 py-3 text-sm text-on-surface-variant">
              <span className="font-medium text-on-surface">{t.trust.consistency}: </span>
              {data.state_consistency.message_plain}
              {data.state_consistency.stale_hint_plain ? ` ${data.state_consistency.stale_hint_plain}` : ''}
            </p>
          )}
          <section className="fc-surface-calm p-5">
            <p className="font-medium text-on-surface">{data.operational_confidence.headline}</p>
            {data.operational_confidence.supporting_line && (
              <p className="mt-2 text-sm text-on-surface-variant">{data.operational_confidence.supporting_line}</p>
            )}
          </section>
          <section className="fc-surface-calm fc-surface-calm--ok px-4 py-4 text-sm text-on-surface-variant">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{t.trust.safeActions}</p>
            <ul className="mt-3 space-y-2">
              <li>{data.safe_actions.confirmation_hint}</li>
              <li>{data.safe_actions.audit_reference_hint}</li>
              <li>{data.safe_actions.undo_window_hint}</li>
              <li>{data.safe_actions.rollback_hint}</li>
            </ul>
          </section>
        </div>
      )}
    </OperationalPage>
  )
}
