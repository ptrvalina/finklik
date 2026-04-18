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
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {filter ? `Сдача отчётности — ${authorityTitle(filter)}` : 'Сдача отчётности'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filter
            ? `Отчёты и отправка в ${authorityTitle(filter)}`
            : 'Выберите орган в меню слева или перейдите в раздел ниже'}
        </p>
      </div>

      {!filter && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
          <span className="w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 lg:hidden">Органы</span>
          {HUB_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="tap-highlight-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-200 transition-colors hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-white"
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
