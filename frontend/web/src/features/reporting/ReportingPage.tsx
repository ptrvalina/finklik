import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import ReportSubmissionsView, { type ReportingAuthority } from './ReportSubmissionsView'
import ReportingGuidedFlow from './ReportingGuidedFlow'
import ReportingReadinessHero from './ReportingReadinessHero'
import { buildReportingPeriodNarrative } from './reportingFlowModel'

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
  const readinessScore = calmOverview?.readiness?.score ?? null
  const blockerCount = calmOverview?.readiness?.blockers?.length ?? 0

  if (authority !== undefined && !isReportingAuthority(authority)) {
    return <Navigate to={base} replace />
  }

  if (filter) {
    return (
      <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
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
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to={focusCta.to} className="btn-primary text-sm">
          {focusCta.label}
        </Link>
        <Link to="/calendar" className="btn-secondary text-sm">
          Календарь
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Готовность</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
            {readinessScore != null ? `${readinessScore}%` : '—'}
          </p>
          <p className="text-[11px] text-primary">{periodNarrative.headline}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Блокеры</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-error sm:text-2xl">{blockerCount}</p>
          <p className="text-[11px] text-on-surface-variant">До сдачи</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Органы</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">4</p>
          <p className="text-[11px] text-on-surface-variant">ИМНС · ФСЗН · БГС · Белстат</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Период</p>
          <p className="mt-1 font-headline text-base font-extrabold text-on-surface sm:text-lg">
            {periodNarrative.phase === 'deadline_pressure' ? 'Срочно' : periodNarrative.phase === 'ready_for_draft' ? 'Черновик' : 'Активный'}
          </p>
          <p className="line-clamp-2 text-[11px] text-on-surface-variant">{periodNarrative.supporting}</p>
        </div>
      </div>

      <ReportingReadinessHero />
      <ReportingGuidedFlow basePath={base} />

      <div
        id="fc-report-authorities"
        className="glass-card flex flex-wrap gap-2 rounded-2xl p-3 sm:gap-3 sm:p-4"
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

      <ReportSubmissionsView authorityFilter={null} />
    </div>
  )
}
