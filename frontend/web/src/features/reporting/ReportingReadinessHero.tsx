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

  const R = 42
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const dashOffset = C * (1 - pct / 100)

  return (
    <div
      className={`fc-execution-card p-5 sm:p-6 ${
        ready ? 'fc-execution-card--tone-ready' : 'fc-execution-card--tone-pending'
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Готовность к сдаче</p>
          <p className="mt-2 font-headline text-lg font-semibold text-on-surface">{period.headline}</p>
          {!ready && (
            <p className="mt-1 text-xs text-on-surface-variant">
              {stepsLeft > 0
                ? `Осталось действий: ${stepsLeft}${firstBlocker ? ` · ${firstBlocker}` : ''}`
                : reason || period.supporting}
            </p>
          )}
          {ready && <p className="mt-1 text-xs text-on-tertiary-container">Можно подавать отчётность.</p>}
          {!ready && (
            <Link to="/accounting/journal" className="btn-primary fc-btn-thumb mt-4 inline-flex rounded-xl px-5 text-sm">
              Исправить в журнале
            </Link>
          )}
        </div>
        {score != null && (
          <div className="relative h-28 w-28 shrink-0 self-center sm:self-auto">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(var(--color-surface-container-high))" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke="url(#readinessGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
              <defs>
                <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0058be" />
                  <stop offset="100%" stopColor="#4edea3" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-2xl font-extrabold tabular-nums text-on-surface">{pct}%</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                {ready ? 'готово' : 'в работе'}
              </span>
            </div>
          </div>
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
