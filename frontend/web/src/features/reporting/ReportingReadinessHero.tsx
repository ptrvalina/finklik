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
    return <div className="fc-skeleton-pulse h-32 rounded-2xl" />
  }

  const blockers = data?.readiness?.blockers ?? []
  const reason = readinessBlockedReason(data)
  const period = buildReportingPeriodNarrative(data)
  const ready = blockers.length === 0 && !reason

  const checklist = [
    ...(blockers.length > 0
      ? blockers.slice(0, 5).map((b) => ({ done: false, label: b.label }))
      : []),
    ...(ready
      ? [{ done: true, label: 'Данные периода согласованы' }]
      : []),
  ]

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Отчётность</p>
          <p className="mt-2 font-headline text-lg font-semibold text-on-surface">{period.headline}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {ready ? 'После этого можно сдавать отчёт.' : reason || period.supporting}
          </p>
        </div>
        <Link to="/reports" className="btn-primary fc-btn-thumb shrink-0 self-start text-sm">
          {ready ? 'Подать отчёт' : 'Открыть отчётность'}
        </Link>
      </div>

      {checklist.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-outline/25 pt-4">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-start gap-2.5 text-sm">
              <span
                className={`material-symbols-outlined mt-0.5 text-lg ${
                  item.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}
                aria-hidden
              >
                {item.done ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span className={item.done ? 'text-on-surface' : 'font-medium text-on-surface'}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {!ready && blockers.length > 0 && (
        <Link to="/accounting/journal" className="btn-ghost mt-4 inline-flex text-sm font-semibold text-primary">
          Исправить в журнале
        </Link>
      )}
    </section>
  )
}
