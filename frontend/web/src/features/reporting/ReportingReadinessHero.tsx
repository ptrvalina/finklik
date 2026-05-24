import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { readinessBlockedReason } from './reportingFlowModel'

export default function ReportingReadinessHero() {
  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  if (isLoading) {
    return <div className="fc-execution-card h-24 animate-pulse rounded-2xl border border-outline/30" />
  }

  const score = data?.readiness?.score ?? null
  const blockers = data?.readiness?.blockers ?? []
  const reason = readinessBlockedReason(data)
  const firstBlocker = blockers[0]?.label

  const ready = score != null && score >= 80 && blockers.length === 0

  return (
    <div
      className={`fc-execution-card rounded-2xl border p-5 sm:p-6 ${
        ready ? 'border-emerald-400/30 bg-emerald-500/[0.05]' : 'border-primary/25 bg-primary/[0.04]'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Готовность к сдаче</p>
          <p className="mt-2 font-headline text-lg font-semibold text-on-surface">
            {ready
              ? 'Можно переходить к проверке и отправке'
              : firstBlocker
                ? firstBlocker
                : reason || 'Дозаполните журнал и документы'}
          </p>
          {score != null && (
            <p className="mt-2 text-sm text-on-surface-variant">
              Оценка готовности: <strong className="text-on-surface">{score}%</strong>
              {blockers.length > 1 && <> · ещё {blockers.length - 1} замечаний</>}
            </p>
          )}
        </div>
        {!ready && (
          <Link to="/accounting" className="btn-primary shrink-0 min-h-11 rounded-xl px-5 text-sm">
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
