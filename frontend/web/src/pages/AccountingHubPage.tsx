import { Link } from 'react-router-dom'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'
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
    document_completeness?: { needs_review?: number }
    reporting_status?: { status?: string }
  } | undefined

  const reviewCount = state?.document_completeness?.needs_review ?? 0
  const reportingBlocked =
    state?.reporting_status?.status === 'blocked' || state?.reporting_status?.status === 'at_risk'

  const focusCta = reviewCount > 0
    ? { label: 'Разобрать сканы', to: '/scan' as const }
    : reportingBlocked
      ? { label: 'Отчётность', to: '/reports' as const }
      : { label: 'Журнал', to: '/accounting/journal' as const }

  return (
    <OperationalPage
      eyebrow="Деньги"
      title="Центр учёта"
      description="Состояние, очереди и один поток: первичка → проводки → готовность отчётности."
      primaryAction={
        <Link to="/accounting/journal" className="btn-primary w-full sm:w-auto">
          <Icon name="edit_note" className="text-lg" /> Журнал операций
        </Link>
      }
      secondaryActions={
        <Link to="/scan" className="btn-secondary w-full sm:w-auto">
          <Icon name="document_scanner" className="text-lg" /> Сканер
        </Link>
      }
      focusStrip={
        <FocusStrip
          headline={
            reviewCount > 0
              ? `${reviewCount} док. ждут проверки`
              : reportingBlocked
                ? 'Отчётность требует внимания'
                : 'Поток учёта без блокеров'
          }
          supporting="Документ → проверка → журнал → отчёт. Контекст сохраняется при переходах."
          ctaLabel={focusCta.label}
          ctaTo={focusCta.to}
        />
      }
    >
      <FinancialStateHero className="mb-6" />

      <AccountingHubPriorities />

      <div className="mt-8">
        <p className="fc-section-label mb-3">Разделы учёта</p>
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-outline/40 bg-surface/80 px-3 text-xs font-semibold text-on-surface transition hover:border-primary/30 hover:bg-primary/5"
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
    </OperationalPage>
  )
}
