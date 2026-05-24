import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import OperationalPage, { FocusStrip } from '../../components/shell/OperationalPage'
import ReportSubmissionsView, { type ReportingAuthority } from './ReportSubmissionsView'
import ReportingGuidedFlow from './ReportingGuidedFlow'

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
  if (authority !== undefined && !isReportingAuthority(authority)) {
    return <Navigate to={base} replace />
  }
  const filter = authority && isReportingAuthority(authority) ? authority : null

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

  return (
    <OperationalPage
      eyebrow="Комплаенс"
      title="Отчётность"
      description="Выберите орган, пройдите guided-поток подготовки и отслеживайте статусы подачи."
      focusStrip={
        <FocusStrip
          headline="Начните с ИМНС или ФСЗН"
          supporting="Система подскажет недостающие данные до отправки."
          ctaLabel="ИМНС"
          ctaTo={`${base}/imns`}
        />
      }
    >
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
