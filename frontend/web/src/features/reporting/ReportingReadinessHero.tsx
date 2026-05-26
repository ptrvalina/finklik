import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { buildReportingPeriodNarrative, readinessBlockedReason } from './reportingFlowModel'

export default function ReportingReadinessHero() {
  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  if (isLoading) {
    return <div className="fc-execution-card fc-skeleton-pulse h-24" />
  }

  const score = data?.readiness?.score ?? null
  const blockers = data?.readiness?.blockers ?? []
  const reason = readinessBlockedReason(data)
  const firstBlocker = blockers[0]?.label
  const period = buildReportingPeriodNarrative(data)

  const ready = score != null && score >= 80 && blockers.length === 0
  const stepsLeft = blockers.length

  return (
    <div
      className={`fc-execution-card p-5 sm:p-6 ${
        ready ? 'fc-execution-card--tone-ready' : 'fc-execution-card--tone-pending'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Готовность к сдаче</p>
          <p className="mt-2 font-headline text-lg font-semibold text-on-surface">{period.headline}</p>
          {!ready && (
            <p className="mt-1 text-xs text-on-surface-variant">
              {stepsLeft > 0
                ? `Блокеров готовности: ${stepsLeft}${firstBlocker ? ` · ${firstBlocker}` : ''}`
                : reason || period.supporting}
            </p>
          )}
          {score != null && (
            <p className="mt-2 text-sm text-on-surface-variant">
              Оценка готовности: <strong className="text-on-surface">{score}%</strong>
              {!ready && stepsLeft > 0 && firstBlocker && (
                <> · сейчас: {firstBlocker}</>
              )}
            </p>
          )}
        </div>
        {!ready && (
          <Link to="/accounting/journal" className="btn-primary fc-btn-thumb shrink-0 rounded-xl px-5 text-sm">
            Исправить в журнале
          </Link>
        )}
      </div>
      {blockers.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-outline/25 pt-4 text-sm text-on-surface-variant">
          {blockers.slice(0, 4).map((b) => (
            <li key={b.code ?? b.label}>· {b.label}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
