import { Link, Navigate, useParams } from 'react-router-dom'
import ReportSubmissionsView, { type ReportingAuthority } from './ReportSubmissionsView'

const VALID_AUTHORITIES: ReportingAuthority[] = ['imns', 'fsszn', 'belgosstrakh', 'belstat']

function isReportingAuthority(s: string | undefined): s is ReportingAuthority {
  return !!s && (VALID_AUTHORITIES as string[]).includes(s)
}

function authorityTitle(a: ReportingAuthority) {
  return a === 'fsszn' ? 'ФСЗН' : a === 'imns' ? 'ИМНС' : a === 'belgosstrakh' ? 'Белгосстрах' : 'Белстат'
}

const HUB_LINKS: { to: string; label: string }[] = [
  { to: '/reporting/imns', label: 'ИМНС' },
  { to: '/reporting/fsszn', label: 'ФСЗН' },
  { to: '/reporting/belgosstrakh', label: 'Белгосстрах' },
  { to: '/reporting/belstat', label: 'Белстат' },
]

export default function ReportingPage() {
  const { authority } = useParams<{ authority?: string }>()
  if (authority !== undefined && !isReportingAuthority(authority)) {
    return <Navigate to="/reporting" replace />
  }
  const filter = authority && isReportingAuthority(authority) ? authority : null

  return (
    <div className="max-w-7xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="page-heading">
          {filter ? `Сдача отчётности — ${authorityTitle(filter)}` : 'Сдача отчётности'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filter
            ? `Отчёты и отправка в ${authorityTitle(filter)}`
            : 'Выберите орган в меню слева или перейдите в раздел ниже'}
        </p>
      </div>

      {!filter && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 shadow-soft sm:p-4">
          <span className="w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 lg:hidden">Органы</span>
          {HUB_LINKS.map((l) => (
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
