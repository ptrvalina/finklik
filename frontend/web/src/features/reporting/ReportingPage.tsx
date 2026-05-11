import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
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

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric">
      <div className="card-elevated relative overflow-hidden rounded-3xl p-4 shadow-lift ring-1 ring-primary/[0.06] sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00332e] via-primary to-emerald-400/90" aria-hidden />
        <h1 className="page-heading">
          {filter ? `Сдача отчётности — ${authorityTitle(filter)}` : 'Отчетность'}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {filter
            ? `Отчёты и отправка в ${authorityTitle(filter)}`
            : 'Выберите орган в меню слева или перейдите в раздел ниже'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 font-semibold text-primary">Подготовка</span>
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Проверка</span>
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Подача</span>
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Статус</span>
        </div>
      </div>

      {!filter && <ReportingGuidedFlow basePath={base} />}

      {!filter && (
        <div
          id="fc-report-authorities"
          className="flex flex-wrap gap-2 rounded-3xl border border-primary/15 bg-gradient-to-r from-primary/[0.05] via-surface-container-low/60 to-transparent p-3 shadow-soft sm:gap-3 sm:p-4"
        >
          <span className="w-full text-[10px] font-bold uppercase tracking-widest text-primary/80 lg:hidden">Органы</span>
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
      )}

      <ReportSubmissionsView authorityFilter={filter} />
    </div>
  )
}
