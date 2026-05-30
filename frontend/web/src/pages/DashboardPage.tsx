import { useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, reportsApi, bankApi, businessOsApi, teamApi } from '../api/client'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import { ExecutiveBriefing } from '../components/dashboard/ExecutiveBriefing'
import ClientJourneyPanel from '../components/dashboard/ClientJourneyPanel'
import WorkNowCard from '../components/dashboard/WorkNowCard'
import DashboardFocusStrip from '../components/dashboard/DashboardFocusStrip'
import { orgQueryKey } from '../lib/queryKeys'

const CashflowPulse = lazy(async () => {
  const m = await import('../components/dashboard/CashflowPulse')
  return { default: m.CashflowPulse }
})
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import { AIRecommendationPanel } from '../components/premium-os'
import OperationalPage from '../components/shell/OperationalPage'
import DashboardDetailsPanel from '../components/dashboard/DashboardDetailsPanel'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import ReportingReadinessHero from '../features/reporting/ReportingReadinessHero'
import DashboardTimeline from '../components/dashboard/DashboardTimeline'

function fmt(n: any) {
  return Number(n || 0).toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const theme = useThemeStore((s) => s.theme)
  const isManager = (user?.role || '').toLowerCase() === 'manager'
  const { data: metrics, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('dashboard'),
    queryFn: () => dashboardApi.getMetrics().then((r) => r.data),
    enabled: !isManager,
    retry: 1,
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const { data: txData } = useQuery({
    queryKey: orgQueryKey(['transactions', 'recent']),
    queryFn: () => dashboardApi.getTransactions({ per_page: 5 }).then((r) => r.data),
    enabled: !isManager,
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const dashboardYear = new Date().getFullYear()
  const { data: summaryData } = useQuery({
    queryKey: orgQueryKey(['monthly-summary-dashboard', dashboardYear]),
    queryFn: () => reportsApi.monthlySummary(dashboardYear).then((r) => r.data),
    enabled: !isManager,
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  })

  const { data: bankData } = useQuery({
    queryKey: orgQueryKey('bank-accounts-dashboard'),
    queryFn: () => bankApi.listAccounts().then((r) => r.data),
    enabled: !isManager,
    staleTime: 60_000,
  })

  /** Остаток по счетам — главная цифра «сколько денег реально есть». Тихо падает на старом бэкенде. */
  const { data: bankBalance } = useQuery({
    queryKey: orgQueryKey('bank-balance-dashboard'),
    queryFn: () => bankApi.getBalance().then((r) => r.data),
    enabled: !isManager,
    retry: false,
    staleTime: 60_000,
  })

  /** Снимок состояния бизнеса (новый API; при старом бэкенде запрос тихо падает — блок скрыт). */
  const { data: businessState } = useQuery({
    queryKey: orgQueryKey('business-state'),
    queryFn: () => businessOsApi.getState().then((r) => r.data),
    enabled: !isManager,
    retry: false,
    staleTime: 60_000,
  })

  const { data: businessProfile } = useQuery({
    queryKey: orgQueryKey('business-profile'),
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data),
    enabled: !isManager,
    staleTime: 120_000,
  })

  const summaryMonths = useMemo(() => {
    const rows = summaryData?.months ?? []
    return rows.map((m: any) => ({
      label: m.label,
      income: Number(m.income ?? 0),
      expense: Number(m.expense ?? 0),
    }))
  }, [summaryData])

  const bankConnected = (((bankData as { accounts?: unknown[] } | undefined)?.accounts ?? []) as unknown[]).length > 0
  const rawBalance = (bankBalance as { balance?: number | string } | undefined)?.balance
  const cashOnHand = bankConnected && rawBalance != null && Number.isFinite(Number(rawBalance)) ? Number(rawBalance) : null

  const chartData = (summaryData?.months ?? [])
    .filter((m: any) => m.income > 0 || m.expense > 0)
    .map((m: any) => ({ month: m.label, income: m.income, expense: m.expense }))

  const transactions = txData?.items ?? []
  const draftCount = transactions.filter((t: any) => t.status === 'draft').length
  const pendingOcr = Number(metrics?.documents_pending_ocr ?? 0)

  const tipStyle = {
    background: theme === 'dark' ? 'rgba(12,24,36,0.94)' : 'rgba(255,255,255,0.96)',
    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(226,232,240,0.9)',
    borderRadius: 16,
    fontSize: 13,
    color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
    boxShadow: theme === 'dark' ? '0 24px 48px -12px rgba(0,0,0,0.65)' : '0 16px 40px -12px rgba(0,77,64,0.18)',
    backdropFilter: 'blur(12px)',
  }

  const axisMuted = theme === 'dark' ? '#64748b' : '#64748b'

  if (!isManager && isLoading) {
    return (
      <div className="fc-page-shell fc-page-shell-asymmetric">
        <div className="mb-6 h-40 max-w-3xl rounded-[1.75rem]">
          <CardSkeleton className="h-full border-0" />
        </div>
        <CardSkeleton className="mt-8 min-h-[140px]" />
        <div className="mt-8 grid gap-4 lg:grid-cols-12">
          <CardSkeleton className="min-h-[220px] lg:col-span-4" />
          <CardSkeleton className="min-h-[220px] lg:col-span-8" />
        </div>
      </div>
    )
  }

  if (!isManager && isError) {
    return (
      <div className="max-w-3xl">
        <h1 className="page-heading mb-4">Главная</h1>
        <CalmErrorState
          title="Главная недоступна"
          fallbackMessage="Не удалось загрузить данные. Проверьте подключение и повторите попытку."
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  const deadline = metrics?.next_tax_deadline
  const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null

  if (isManager) {
    return (
      <div className="fc-page-shell-tight">
        <div className="fc-hero">
          <div className="fc-hero-strip" aria-hidden />
          <h1 className="page-heading">Главная</h1>
          <p className="mt-2 text-on-surface-variant">Виджет менеджера: новые задачи, сканы и отчёты команды.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link to="/scan" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Загрузить скан</p>
            <p className="mt-1 text-sm text-on-surface-variant">Камера или файл документа</p>
          </Link>
          <Link to="/planner" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Создать задачу</p>
            <p className="mt-1 text-sm text-on-surface-variant">Поручение собственнику/бухгалтеру</p>
          </Link>
          <Link to="/planner" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Подготовить отчёт</p>
            <p className="mt-1 text-sm text-on-surface-variant">Ответить на запрос в планере</p>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <OperationalPage
      eyebrow="Сегодня"
      title="Главная"
      description={`УСН · Беларусь · ${new Date().toLocaleDateString('ru-BY', { month: 'long', year: 'numeric' })}`}
      primaryAction={
        <Link to="/operations" className="btn-primary fc-btn-thumb text-sm">
          Лента работы
        </Link>
      }
      secondaryActions={
        <Link to="/accounting/journal" className="btn-secondary fc-btn-thumb text-sm">
          <Icon name="receipt_long" className="text-lg" /> Журнал
        </Link>
      }
    >
      {/* Financial OS Home: ровно 5 блоков над сгибом — состояние, действие, блокеры, готовность, события. */}
      <FinancialStateHero className="mb-6" cashOnHand={cashOnHand} />

      <div className="mb-6">
        <WorkNowCard />
      </div>

      <DashboardFocusStrip
        draftCount={draftCount}
        pendingOcr={pendingOcr}
        overdueCount={Number(businessState?.overdue_obligations_count ?? 0)}
        daysLeft={daysLeft}
        profileIncomplete={businessProfile ? !businessProfile.business_profile_completed : false}
      />

      <div className="mt-6">
        <ReportingReadinessHero />
      </div>

      <div className="mt-6">
        <DashboardTimeline transactions={transactions} />
      </div>

      <OnboardingChecklist />

      <DashboardDetailsPanel title="Аналитика, налоги и операции">
      <ExecutiveBriefing metrics={metrics} months={summaryMonths} draftCount={draftCount} bankConnected={bankConnected} />

      <div className="mt-8">
        <ClientJourneyPanel metrics={metrics} transactions={transactions} />
      </div>

      <div className="mt-8">
        <AIRecommendationPanel metrics={metrics} transactions={transactions} />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Денежный пульс</p>
        <Suspense fallback={<div className="h-52 rounded-3xl border border-outline/30 bg-surface-container-low/40 animate-pulse dark:border-white/[0.06]" aria-hidden />}>
          <CashflowPulse chartData={chartData} theme={theme} tipStyle={tipStyle} axisMuted={axisMuted} />
        </Suspense>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="label mb-6 flex items-center gap-2">
            <Icon name="calculate" className="text-lg text-emerald-500" />
            Налоги к уплате
          </h3>
          <div className="space-y-5">
            {[
              { name: 'УСН 6%', amount: metrics?.tax_usn_quarter ?? 0, due: true },
              { name: 'НДС (0/10/20%)', amount: metrics?.tax_vat_month ?? 0, due: true },
              { name: 'ФСЗН 34%', amount: metrics?.tax_fsszn_quarter ?? 0, due: false },
            ].map((tax) => (
              <div key={tax.name}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-on-surface">{tax.name}</span>
                  <span className="font-bold text-on-surface">{fmt(tax.amount)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div className={`h-full rounded-full ${tax.due ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: tax.due ? '70%' : '100%' }} />
                </div>
                <p className="mt-1 text-[10px] text-on-surface-variant">{tax.due ? 'К уплате' : 'Уплачен'}</p>
              </div>
            ))}
          </div>
        </div>

        {deadline && (
          <div className="glass-card rounded-2xl border-l-4 border-l-emerald-400/60 p-6">
            <div className="mb-3 flex items-center gap-3">
              <Icon name="event" filled className="text-emerald-500" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Ближайший дедлайн</span>
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface">{deadline}</p>
            {daysLeft !== null && (
              <p className="mt-1 text-xs text-on-surface-variant">
                {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} осталось
              </p>
            )}
          </div>
        )}
      </div>
      </DashboardDetailsPanel>
    </OperationalPage>
  )
}
