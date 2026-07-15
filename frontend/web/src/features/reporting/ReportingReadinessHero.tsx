import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
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
    return <div className="fc-skeleton-pulse h-28 rounded-2xl" />
  }

  const period = buildReportingPeriodNarrative(data)
  const checklist = buildHomeReportingChecklist(data)
  const doneCount = checklist.filter((item) => item.done).length
  const ready = checklist.length > 0 && doneCount === checklist.length
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0

  return (
    <section className="relative overflow-hidden rounded-2xl border border-outline/30 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Отчётность</p>
          <p className="mt-1 font-headline text-sm font-semibold text-on-surface">{period.headline}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {doneCount} из {checklist.length} шагов
          </p>
        </div>
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" className="stroke-outline/30" strokeWidth="3" />
            <motion.circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              className={ready ? 'stroke-emerald-500' : 'stroke-primary'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${pct * 0.94} 100`}
              initial={{ strokeDasharray: '0 100' }}
              animate={{ strokeDasharray: `${pct * 0.94} 100` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <span className="text-[10px] font-bold tabular-nums text-on-surface">{pct}%</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-outline/20 pt-3">
        {checklist.map((item, i) => (
          <motion.li
            key={item.label}
            className="flex items-center gap-2 text-sm"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.04 }}
          >
            <span
              className={`material-symbols-outlined text-base ${item.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface-variant/50'}`}
              aria-hidden
            >
              {item.done ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className={item.done ? 'text-on-surface-variant line-through decoration-outline/40' : 'font-medium text-on-surface'}>
              {item.label}
            </span>
          </motion.li>
        ))}
      </ul>

      <Link
        to="/reports"
        className={`mt-3 inline-flex min-h-9 items-center text-xs font-bold ${ready ? 'text-emerald-700 dark:text-emerald-300' : 'text-primary'} hover:underline`}
      >
        {ready ? 'Подготовить пакет →' : 'Открыть готовность →'}
      </Link>
    </section>
  )
}
