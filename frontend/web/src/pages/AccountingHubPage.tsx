import { Link } from 'react-router-dom'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import AccountingHubPriorities from '../components/accounting/AccountingHubPriorities'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import { terminology } from '../i18n/terminology.ru'

const SHORTCUTS = [
  { to: '/accounting/journal', icon: 'menu_book', label: 'Журнал' },
  { to: '/scan', icon: 'document_scanner', label: 'Сканер' },
  { to: '/bank', icon: 'account_balance_wallet', label: 'Банк' },
  { to: '/documents', icon: 'folder_open', label: 'Документы' },
  { to: '/accounting/chart', icon: 'account_tree', label: 'План счетов' },
  { to: '/counterparties', icon: 'handshake', label: 'Контрагенты' },
]

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function AccountingHubPage() {
  const { data } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 45_000,
  })

  const state = data?.state as {
    document_completeness?: { needs_review?: number; pending_ocr?: number }
    reporting_status?: { status?: string; readiness_score?: number }
    compliance_state?: { pending_approvals?: number }
  } | undefined

  const reviewCount = state?.document_completeness?.needs_review ?? 0
  const ocrPending = state?.document_completeness?.pending_ocr ?? 0
  const reportingBlocked =
    state?.reporting_status?.status === 'blocked' || state?.reporting_status?.status === 'at_risk'
  const readiness = state?.reporting_status?.readiness_score ?? null

  const focusCta = reviewCount > 0
    ? { label: 'Разобрать сканы', to: '/scan' as const }
    : reportingBlocked
      ? { label: 'Отчётность', to: '/reports' as const }
      : { label: 'Журнал', to: '/accounting/journal' as const }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to="/scan" className="btn-secondary w-full sm:w-auto">
          <Icon name="document_scanner" className="text-lg" /> Сканер
        </Link>
        <Link to={focusCta.to} className="btn-primary w-full sm:w-auto">
          <Icon name="edit_note" className="text-lg" /> {focusCta.label}
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">OCR</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{ocrPending}</p>
          <p className="text-[11px] text-on-surface-variant">В очереди</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">На проверке</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-primary sm:text-2xl">{reviewCount}</p>
          <p className="text-[11px] text-primary">Документов</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Отчётность</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
            {readiness != null ? `${readiness}%` : reportingBlocked ? '!' : '—'}
          </p>
          <p className="text-[11px] text-on-surface-variant">Готовность</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Разделы</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{SHORTCUTS.length}</p>
          <p className="text-[11px] text-on-surface-variant">Учётный контур</p>
        </div>
      </div>

      <FinancialStateHero className="mb-6" />

      <AccountingHubPriorities />

      <div className="mt-8">
        <p className="fc-section-label mb-3">Разделы учёта</p>
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="fc-nav-chip"
            >
              <Icon name={s.icon} className="text-base text-primary" />
              {s.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-on-surface-variant">
          {terminology.accounting.chartStandard} — план счетов и субсчета в разделе «План счетов».
        </p>
      </div>
    </div>
  )
}
