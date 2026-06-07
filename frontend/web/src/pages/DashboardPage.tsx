import { useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, reportsApi, bankApi, teamApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import WorkNowCard from '../components/dashboard/WorkNowCard'
import DashboardBlockers from '../components/dashboard/DashboardBlockers'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import ReportingReadinessHero from '../features/reporting/ReportingReadinessHero'
import DashboardTimeline from '../components/dashboard/DashboardTimeline'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import DashboardDetailsPanel from '../components/dashboard/DashboardDetailsPanel'
import { orgQueryKey } from '../lib/queryKeys'

const CashflowPulse = lazy(async () => {
  const m = await import('../components/dashboard/CashflowPulse')
  return { default: m.CashflowPulse }
})

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

  const { data: bankBalance } = useQuery({
    queryKey: orgQueryKey('bank-balance-dashboard'),
    queryFn: () => bankApi.getBalance().then((r) => r.data),
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

  const chartData = useMemo(
    () =>
      (summaryData?.months ?? [])
        .filter((m: any) => m.income > 0 || m.expense > 0)
        .map((m: any) => ({ month: m.label, income: m.income, expense: m.expense })),
    [summaryData],
  )

  const bankConnected = (((bankData as { accounts?: unknown[] } | undefined)?.accounts ?? []) as unknown[]).length > 0
  const rawBalance = (bankBalance as { balance?: number | string } | undefined)?.balance
  const cashOnHand = bankConnected && rawBalance != null && Number.isFinite(Number(rawBalance)) ? Number(rawBalance) : null

  const transactions = txData?.items ?? []
  const profileIncomplete = businessProfile ? !businessProfile.business_profile_completed : false

  const tipStyle = {
    background: theme === 'dark' ? 'rgba(12,24,36,0.94)' : 'rgba(255,255,255,0.96)',
    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(226,232,240,0.9)',
    borderRadius: 16,
    fontSize: 13,
    color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
    boxShadow: theme === 'dark' ? '0 24px 48px -12px rgba(0,0,0,0.65)' : '0 16px 40px -12px rgba(0,77,64,0.18)',
    backdropFilter: 'blur(12px)',
  }

  const axisMuted = '#64748b'

  if (!isManager && isLoading) {
    return (
      <div className="fc-page-shell fc-page-shell-asymmetric">
        <CardSkeleton className="min-h-[120px]" />
        <CardSkeleton className="mt-4 min-h-[100px]" />
        <CardSkeleton className="mt-4 min-h-[48px]" />
        <CardSkeleton className="mt-4 min-h-[100px]" />
        <CardSkeleton className="mt-4 min-h-[140px]" />
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

  if (isManager) {
    return (
      <div className="fc-page-shell-tight">
        <div className="fc-hero">
          <div className="fc-hero-strip" aria-hidden />
          <h1 className="page-heading">Главная</h1>
          <p className="mt-2 text-on-surface-variant">Новые задачи, сканы и отчёты команды.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link to="/scan" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Загрузить скан</p>
            <p className="mt-1 text-sm text-on-surface-variant">Камера или файл документа</p>
          </Link>
          <Link to="/planner" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Создать задачу</p>
            <p className="mt-1 text-sm text-on-surface-variant">Поручение собственнику или бухгалтеру</p>
          </Link>
          <Link to="/planner" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Подготовить отчёт</p>
            <p className="mt-1 text-sm text-on-surface-variant">Ответить на запрос в планёре</p>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric fc-scroll-region pb-24 lg:pb-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <FinancialStateHero
          cashOnHand={cashOnHand}
          nextTaxDeadline={metrics?.next_tax_deadline ?? null}
          dashboardLite
          compact
        />
        <WorkNowCard />
        <DashboardBlockers />
        <ReportingReadinessHero />
        <DashboardTimeline transactions={transactions} />
      </div>

      {profileIncomplete && <OnboardingChecklist />}

      {chartData.length > 0 && (
        <DashboardDetailsPanel title="Денежный пульс и налоги">
          <Suspense
            fallback={
              <div
                className="h-52 animate-pulse rounded-3xl border border-outline/30 bg-surface-container-low/40 dark:border-white/[0.06]"
                aria-hidden
              />
            }
          >
            <CashflowPulse chartData={chartData} theme={theme} tipStyle={tipStyle} axisMuted={axisMuted} />
          </Suspense>
        </DashboardDetailsPanel>
      )}
    </div>
  )
}
