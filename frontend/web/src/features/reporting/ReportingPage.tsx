import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ReportSubmissionsView, { type ReportingAuthority } from './ReportSubmissionsView'

const VALID_AUTHORITIES: ReportingAuthority[] = ['imns', 'fsszn', 'belgosstrakh', 'belstat']

function isReportingAuthority(s: string | undefined): s is ReportingAuthority {
  return !!s && (VALID_AUTHORITIES as string[]).includes(s)
}

function authorityTitle(a: ReportingAuthority) {
  return a === 'fsszn' ? 'ФСЗН' : a === 'imns' ? 'ИМНС' : a === 'belgosstrakh' ? 'Белгосстрах' : 'Белстат'
}

export type ReportingPageProps = {
  /** Базовый путь меню: `/reports` (основной) или `/reporting` (legacy alias). */
  basePath?: string
}

export default function ReportingPage({ basePath = '/reporting' }: ReportingPageProps) {
  const base = basePath.replace(/\/$/, '') || '/reporting'
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
    <div className="max-w-7xl space-y-5 sm:space-y-6">
      <div className="card-elevated p-4 sm:p-5">
        <h1 className="page-heading">
          {filter ? `Сдача отчётности — ${authorityTitle(filter)}` : 'Отчетность'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filter
            ? `Отчёты и отправка в ${authorityTitle(filter)}`
            : 'Выберите орган в меню слева или перейдите в раздел ниже'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Подготовка</span>
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Проверка</span>
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Подача</span>
          <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">Статус</span>
        </div>
      </div>

      {!filter && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 shadow-soft sm:p-4">
          <span className="w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 lg:hidden">Органы</span>
          {hubLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="tap-highlight-none rounded-lg border border-zinc-200/90 bg-surface px-3 py-2 text-xs font-bold text-zinc-800 transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary dark:border-zinc-700/80 dark:text-zinc-200"
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
