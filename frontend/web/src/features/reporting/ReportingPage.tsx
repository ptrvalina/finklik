import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import ReportSubmissionsView, { type ReportingAuthority } from './ReportSubmissionsView'
import ReportingGuidedFlow from './ReportingGuidedFlow'
import { buildReportingPeriodNarrative } from './reportingFlowModel'
import { WorkflowContinuityBar } from '../../components/workflow'

const VALID_AUTHORITIES: ReportingAuthority[] = ['imns', 'fsszn', 'belgosstrakh', 'belstat']

function isReportingAuthority(s: string | undefined): s is ReportingAuthority {
  return !!s && (VALID_AUTHORITIES as string[]).includes(s)
}

function authorityTitle(a: ReportingAuthority) {
  return a === 'fsszn' ? 'ФСЗН' : a === 'imns' ? 'ИМНС' : a === 'belgosstrakh' ? 'Белгосстрах' : 'Белстат'
}

export type ReportingPageProps = {
  /** Базовый путь хаба отчётности: по умолчанию `/reports`; для legacy — `/legacy/reporting`. */
  basePath?: string
}

export default function ReportingPage({ basePath = '/reports' }: ReportingPageProps) {
  const base = basePath.replace(/\/$/, '') || '/reports'
  const hubLinks = useMemo(
    () =>
      (['imns', 'fsszn', 'belgosstrakh', 'belstat'] as const).map((id) => ({
        to: `${base}/${id}`,
        label: authorityTitle(id),
      })),
    [base],
  )

  const { authority } = useParams<{ authority?: string }>()
  const filter = authority && isReportingAuthority(authority) ? authority : null

  const { data: calmOverview } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
    enabled: !filter,
  })

  const periodNarrative = useMemo(() => buildReportingPeriodNarrative(calmOverview), [calmOverview])
  const blockerCount = calmOverview?.readiness?.blockers?.length ?? 0

  if (authority !== undefined && !isReportingAuthority(authority)) {
    return <Navigate to={base} replace />
  }

  if (filter) {
    return (
      <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
        <WorkflowContinuityBar />
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Link to={base} className="btn-secondary !min-h-10 text-xs">
            Все органы
          </Link>
          <Link to="/calendar" className="btn-secondary text-sm">
            Календарь сроков
          </Link>
        </div>
        <ReportSubmissionsView authorityFilter={filter} />
      </div>
    )
  }

  const focusCta =
    periodNarrative.phase === 'deadline_pressure'
      ? { label: 'Календарь сроков', to: '/calendar' }
      : periodNarrative.phase === 'ready_for_draft'
        ? { label: 'Черновик ИМНС', to: `${base}/imns` }
        : { label: 'ИМНС', to: `${base}/imns` }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <WorkflowContinuityBar />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-heading">Отчётность</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{periodNarrative.headline}</p>
          {blockerCount > 0 && (
            <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
              Не хватает данных: {blockerCount} {blockerCount === 1 ? 'шаг' : blockerCount < 5 ? 'шага' : 'шагов'}
            </p>
          )}
          {blockerCount === 0 && (
            <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">Можно подавать отчётность</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={focusCta.to} className="btn-primary text-sm">
            {focusCta.label}
          </Link>
          <Link to="/calendar" className="btn-secondary text-sm">
            Календарь
          </Link>
        </div>
      </div>

      <ReportingGuidedFlow basePath={base} />

      <div
        id="fc-report-authorities"
        className="glass-card mt-6 flex flex-wrap gap-2 rounded-2xl p-3 sm:gap-3 sm:p-4"
      >
        <span className="w-full text-[10px] font-bold uppercase tracking-widest text-primary/80">Органы</span>
        {hubLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="tap-highlight-none rounded-xl border border-outline/70 bg-surface px-4 py-2.5 text-xs font-bold text-on-surface shadow-xs transition hover:border-primary/40 hover:bg-primary/[0.07] hover:text-primary"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
