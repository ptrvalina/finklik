import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, bankApi, teamApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import WorkNowCard from '../components/dashboard/WorkNowCard'
import DashboardBlockers from '../components/dashboard/DashboardBlockers'
import DashboardBusinessCalendar from '../components/dashboard/DashboardBusinessCalendar'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import ReportingReadinessHero from '../features/reporting/ReportingReadinessHero'
import DashboardTimeline from '../components/dashboard/DashboardTimeline'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import { orgQueryKey } from '../lib/queryKeys'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const isManager = (user?.role || '').toLowerCase() === 'manager'
  const { data: metrics, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('dashboard'),
    queryFn: () => dashboardApi.getMetrics().then((r) => r.data),
    enabled: !isManager,
    retry: 1,
    staleTime: 45_000,
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

  const bankConnected = (((bankData as { accounts?: unknown[] } | undefined)?.accounts ?? []) as unknown[]).length > 0
  const rawBalance = (bankBalance as { balance?: number | string } | undefined)?.balance
  const cashOnHand = bankConnected && rawBalance != null && Number.isFinite(Number(rawBalance)) ? Number(rawBalance) : null

  const profileIncomplete = businessProfile ? !businessProfile.business_profile_completed : false

  const metricsForHero = useMemo(
    () =>
      metrics
        ? {
            next_tax_deadline: metrics.next_tax_deadline,
            tax_usn_quarter: metrics.tax_usn_quarter,
            tax_vat_month: metrics.tax_vat_month,
            tax_fsszn_quarter: metrics.tax_fsszn_quarter,
          }
        : undefined,
    [metrics],
  )

  if (!isManager && isLoading) {
    return (
      <div className="fc-page-shell fc-page-shell-asymmetric">
        <CardSkeleton className="min-h-[120px]" />
        <CardSkeleton className="mt-3 min-h-[88px]" />
        <CardSkeleton className="mt-3 min-h-[120px]" />
        <CardSkeleton className="mt-3 min-h-[88px]" />
        <CardSkeleton className="mt-3 min-h-[100px]" />
        <CardSkeleton className="mt-3 min-h-[100px]" />
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
      <div className="mx-auto max-w-3xl space-y-3">
        <FinancialStateHero cashOnHand={cashOnHand} metrics={metricsForHero} dashboardLite compact />
        <WorkNowCard />
        <DashboardBusinessCalendar />
        <DashboardBlockers />
        <ReportingReadinessHero />
        <DashboardTimeline />
      </div>

      {profileIncomplete && <OnboardingChecklist />}
    </div>
  )
}
