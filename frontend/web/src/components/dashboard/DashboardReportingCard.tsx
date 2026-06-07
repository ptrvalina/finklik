import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi, reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { deriveOwnerReportingStatus } from '../../features/reporting/reportingFlowModel'

const TONE_CLASS = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  action: 'text-primary',
  warn: 'text-amber-700 dark:text-amber-400',
}

export default function DashboardReportingCard() {
  const { data: calm, isLoading: calmLoading } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  const { data: fs, isLoading: fsLoading } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
  })

  const status = deriveOwnerReportingStatus(calm, fs?.state)
  const isLoading = calmLoading || fsLoading

  return (
    <article className="fc-dashboard-card fc-dashboard-card--short flex flex-col">
      <h2 className="fc-dashboard-card-title">Отчётность</h2>

      {isLoading ? (
        <div className="fc-skeleton-pulse mt-2 h-16 flex-1 rounded-lg" />
      ) : (
        <div className="mt-2 flex flex-col justify-center">
          <p className={`font-headline text-lg font-bold leading-snug sm:text-xl ${TONE_CLASS[status.tone]}`}>
            {status.label}
          </p>
          {status.hint ? <p className="mt-1 text-xs text-on-surface-variant">{status.hint}</p> : null}
        </div>
      )}

      <Link to="/reports" className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline">
        Перейти к отчётности →
      </Link>
    </article>
  )
}
