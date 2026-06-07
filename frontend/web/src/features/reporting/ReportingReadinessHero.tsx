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
    return <div className="fc-skeleton-pulse h-28 rounded-xl" />
  }

  const period = buildReportingPeriodNarrative(data)
  const checklist = buildHomeReportingChecklist(data)
  const ready = checklist.every((item) => item.done)

  return (
    <section className="rounded-xl border border-outline/30 bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Отчётность</p>
          <p className="mt-1 font-headline text-base font-semibold text-on-surface">{period.headline}</p>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {ready ? 'Можно переходить к подписи и отправке.' : 'Закройте пункты чеклиста перед подачей.'}
          </p>
        </div>
        <Link to="/reports" className="btn-secondary fc-btn-thumb shrink-0 self-start text-sm">
          {ready ? 'Подать отчёт' : 'Открыть отчётность'}
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-outline/20 pt-3">
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
