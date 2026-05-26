import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import OperationalPage, { FocusStrip } from '../../components/shell/OperationalPage'
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

  if (authority !== undefined && !isReportingAuthority(authority)) {
    return <Navigate to={base} replace />
  }

  if (filter) {
    return (
      <OperationalPage
        eyebrow="Комплаенс"
        title={`Сдача отчётности — ${authorityTitle(filter)}`}
        description={`Подготовка, проверка и отправка отчётов в ${authorityTitle(filter)}.`}
        primaryAction={
          <Link to={base} className="btn-secondary !min-h-10 text-xs">
            Все органы
          </Link>
        }
      >
        <ReportSubmissionsView authorityFilter={filter} />
      </OperationalPage>
    )
  }

  const focusCta =
    periodNarrative.phase === 'deadline_pressure'
      ? { label: 'Календарь сроков', to: '/calendar' }
      : periodNarrative.phase === 'ready_for_draft'
        ? { label: 'Черновик ИМНС', to: `${base}/imns` }
        : { label: 'ИМНС', to: `${base}/imns` }

  return (
    <OperationalPage
      eyebrow="Комплаенс"
      title="Отчётность"
      description="Отчётный период, готовность данных и пошаговая подготовка к сдаче."
      focusStrip={
        <FocusStrip
          headline={periodNarrative.headline}
          supporting={periodNarrative.supporting}
          ctaLabel={focusCta.label}
          ctaTo={focusCta.to}
        />
      }
    >
      <ReportingReadinessHero />
      <ReportingGuidedFlow basePath={base} />

      <div
        id="fc-report-authorities"
        className="flex flex-wrap gap-2 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.05] via-surface-container-low/60 to-transparent p-3 sm:gap-3 sm:p-4"
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
    </OperationalPage>
  )
}
