import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { buildHomeReportingChecklist, buildReportingPeriodNarrative } from './reportingFlowModel'

export default function ReportingReadinessHero() {
  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  if (isLoading) {
    return <div className="fc-skeleton-pulse h-24 rounded-xl" />
  }

  const period = buildReportingPeriodNarrative(data)
  const checklist = buildHomeReportingChecklist(data)
  const ready = checklist.every((item) => item.done)

  return (
    <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Отчётность</p>
          <p className="mt-1 font-headline text-sm font-semibold text-on-surface">{period.headline}</p>
        </div>
        <Link to="/reports" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          {ready ? 'Подать →' : 'Открыть →'}
        </Link>
      </div>

      <ul className="mt-2.5 space-y-1 border-t border-outline/20 pt-2.5">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className={`material-symbols-outlined text-base ${item.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface-variant/50'}`}
              aria-hidden
            >
              {item.done ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className={item.done ? 'text-on-surface-variant line-through decoration-outline/40' : 'font-medium text-on-surface'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
