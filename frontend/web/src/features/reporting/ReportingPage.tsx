import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import ReportSubmissionsView, { type ReportingAuthority } from './ReportSubmissionsView'
import ReportingGuidedFlow from './ReportingGuidedFlow'
import { buildReportingPeriodNarrative } from './reportingFlowModel'
import AccountingNavTabs from '../../components/accounting/AccountingNavTabs'
import { GlassCard, HeroGradient, StatusChip } from '../../components/stitch'

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
  const readinessScore = calmOverview?.readiness?.score ?? null

  if (authority !== undefined && !isReportingAuthority(authority)) {
    return <Navigate to={base} replace />
  }

  if (filter) {
    return (
      <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
        <AccountingNavTabs />
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Link to="/accounting/journal" className="btn-secondary !min-h-10 text-xs">
            Журнал
          </Link>
          <Link to={base} className="btn-secondary !min-h-10 text-xs">
            Все органы
          </Link>
          <Link to="/calendar" className="btn-secondary text-sm">
            Календарь
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
      <AccountingNavTabs />

      <HeroGradient className="relative mb-section-sm overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="space-y-4">
            <StatusChip variant="ready" className="bg-tertiary-container text-tertiary-fixed normal-case tracking-normal">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-tertiary-fixed" aria-hidden />
              {periodNarrative.headline || 'Отчётность'}
            </StatusChip>
            <h2 className="font-display-lg text-display-lg text-white">Отчёты в органы</h2>
            <p className="max-w-md text-primary-fixed/90">
              Подача в ИМНС, ФСЗН, Белгосстрах и Белстат после проведения операций в журнале.
              {blockerCount > 0
                ? ` Не хватает данных: ${blockerCount} ${blockerCount === 1 ? 'шаг' : blockerCount < 5 ? 'шага' : 'шагов'}.`
                : ' Можно подавать отчётность.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to={focusCta.to}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-primary shadow-lg transition hover:shadow-primary-container/20 active:scale-95"
              >
                {focusCta.label}
              </Link>
              <Link
                to="/calendar"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
              >
                Календарь
              </Link>
            </div>
          </div>
          <GlassCard hover={false} className="mt-4 w-full border-white/10 bg-white/5 p-6 backdrop-blur-xl md:mt-0 md:w-80">
            <p className="mb-4 font-label text-label-caps uppercase tracking-widest text-primary-fixed/70">Готовность пакета</p>
            <div className="flex h-20 items-end gap-1">
              {[40, 65, 45, 90, 70, 85, Math.min(readinessScore ?? 60, 100)].map((h, i) => (
                <div
                  key={i}
                  className={`w-full rounded-t-sm ${i === 6 ? 'bg-tertiary-fixed-dim' : 'bg-primary-fixed-dim'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono-data text-display-lg text-white">{readinessScore != null ? `${readinessScore}%` : '—'}</span>
              <span className="text-xs font-bold text-tertiary-fixed">
                {blockerCount === 0 ? 'Готово к подаче' : `${blockerCount} замеч.`}
              </span>
            </div>
          </GlassCard>
        </div>
      </HeroGradient>

      <ReportingGuidedFlow basePath={base} />

      <GlassCard hover={false} className="mt-6 flex flex-wrap gap-2 p-3 sm:gap-3 sm:p-4" id="fc-report-authorities">
        <span className="w-full font-label text-label-caps uppercase tracking-widest text-primary/80">Органы</span>
        {hubLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="tap-highlight-none rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs font-bold text-on-surface shadow-xs transition hover:border-primary/40 hover:bg-primary/[0.07] hover:text-primary"
          >
            {l.label}
          </Link>
        ))}
      </GlassCard>
    </div>
  )
}
