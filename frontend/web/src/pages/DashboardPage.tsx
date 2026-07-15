import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { bankApi, teamApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import BusinessHero from '../components/dashboard/BusinessHero'
import WorkNowCard from '../components/dashboard/WorkNowCard'
import ReportingReadinessHero from '../features/reporting/ReportingReadinessHero'
import DashboardCalendarCard from '../components/dashboard/DashboardCalendarCard'
import DashboardAttentionCard from '../components/dashboard/DashboardAttentionCard'
import DashboardObligationsCard from '../components/dashboard/DashboardObligationsCard'
import DashboardActivityCard from '../components/dashboard/DashboardActivityCard'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import { orgQueryKey } from '../lib/queryKeys'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const isManager = (user?.role || '').toLowerCase() === 'manager'
  const isAccountant = (user?.role || '').toLowerCase() === 'accountant'

  useEffect(() => {
    if (isAccountant) navigate('/workspace/queues', { replace: true })
  }, [isAccountant, navigate])

  if (isAccountant) return null

  const { data: bankData, isLoading: bankAccountsLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('bank-accounts-dashboard'),
    queryFn: () => bankApi.listAccounts().then((r) => r.data),
    enabled: !isManager,
    staleTime: 60_000,
  })

  const { data: bankBalance, isLoading: balanceLoading } = useQuery({
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
  const isLoading = bankAccountsLoading || balanceLoading

  if (!isManager && isLoading) {
    return (
      <div className="fc-owner-dashboard">
        <CardSkeleton className="min-h-[180px] rounded-2xl" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CardSkeleton className="min-h-[200px] rounded-xl" />
          <CardSkeleton className="min-h-[200px] rounded-xl" />
          <CardSkeleton className="min-h-[200px] rounded-xl" />
          <CardSkeleton className="min-h-[200px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!isManager && isError) {
    return (
      <div className="fc-owner-dashboard max-w-3xl">
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
            <p className="font-headline font-semibold">Создать поручение</p>
            <p className="mt-1 text-sm text-on-surface-variant">Задача для бухгалтера или владельца</p>
          </Link>
          <Link to="/planner" className="card-elevated p-6 transition hover:-translate-y-0.5">
            <p className="font-headline font-semibold">Ответить на поручение</p>
            <p className="mt-1 text-sm text-on-surface-variant">Отчёт или комментарий по задаче</p>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="fc-owner-dashboard fc-bcc fc-scroll-region space-y-gutter pb-20 lg:pb-6">
      <BusinessHero cashOnHand={cashOnHand} />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
        <WorkNowCard />
        <ReportingReadinessHero />
      </div>

      <div className="fc-bcc-grid grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-6">
          <DashboardObligationsCard />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <DashboardCalendarCard />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <DashboardActivityCard />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <DashboardAttentionCard />
        </div>
      </div>

      <div className="mt-3">
        <OnboardingChecklist />
      </div>
      {profileIncomplete && (
        <p className="text-center text-xs text-on-surface-variant">
          Профиль бизнеса ещё не завершён —{' '}
          <Link to="/onboarding/business-profile" className="font-semibold text-primary hover:underline">
            продолжить настройку
          </Link>
        </p>
      )}
    </div>
  )
}
