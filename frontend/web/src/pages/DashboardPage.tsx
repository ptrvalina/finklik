import { useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, reportsApi, bankApi, businessOsApi, teamApi } from '../api/client'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import { ExecutiveBriefing } from '../components/dashboard/ExecutiveBriefing'
import DashboardFocusStrip from '../components/dashboard/DashboardFocusStrip'
import { orgQueryKey } from '../lib/queryKeys'

const CashflowPulse = lazy(async () => {
  const m = await import('../components/dashboard/CashflowPulse')
  return { default: m.CashflowPulse }
})
import { GlassCard } from '../components/premium/GlassCard'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import { AIRecommendationPanel } from '../components/premium-os'

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
    queryKey: ['transactions', 'recent'],
    queryFn: () => dashboardApi.getTransactions({ per_page: 5 }).then((r) => r.data),
    enabled: !isManager,
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const dashboardYear = new Date().getFullYear()
  const { data: summaryData } = useQuery({
    queryKey: ['monthly-summary-dashboard', dashboardYear],
    queryFn: () => reportsApi.monthlySummary(dashboardYear).then((r) => r.data),
    enabled: !isManager,
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  })

  const { data: bankData } = useQuery({
    queryKey: ['bank-accounts-dashboard'],
    queryFn: () => bankApi.listAccounts().then((r) => r.data),
    enabled: !isManager,
    staleTime: 60_000,
  })

  /** Business OS snapshot (новый API; при старом бэкенде запрос тихо падает — блок скрыт). */
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

  const chartData = (summaryData?.months ?? [])
    .filter((m: any) => m.income > 0 || m.expense > 0)
    .map((m: any) => ({ month: m.label, income: m.income, expense: m.expense }))

  const transactions = txData?.items ?? []
  const draftCount = transactions.filter((t: any) => t.status === 'draft').length

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
        <GlassCard className="p-6" hoverLift={false}>
          <h1 className="page-heading">Главная</h1>
          <p className="mt-2 text-on-surface-variant">Не удалось загрузить данные дашборда. Проверьте подключение к API и повторите попытку.</p>
          <button type="button" className="btn-primary mt-4" onClick={() => refetch()}>
            Повторить
          </button>
        </GlassCard>
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
    <div className="fc-page-shell fc-page-shell-asymmetric">
      {/* Page intro */}
      <div className="fc-hero flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="fc-hero-strip" aria-hidden />
        <div className="relative z-[1] flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-600/90 dark:text-emerald-400/90">Операционный центр</p>
            <h1 className="page-heading mt-1">Главная</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
              УСН · Беларусь · {new Date().toLocaleDateString('ru-BY', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="page-actions sm:w-auto sm:flex-row sm:gap-3">
            <Link to="/accounting" className="btn-secondary !py-2.5 text-sm">
              <Icon name="file_download" className="text-lg" />
              Экспорт
            </Link>
          </div>
        </div>
      </div>

      <ExecutiveBriefing metrics={metrics} months={summaryMonths} draftCount={draftCount} bankConnected={bankConnected} />

      <DashboardFocusStrip
        draftCount={draftCount}
        pendingOcr={Number(metrics?.documents_pending_ocr ?? 0)}
        overdueCount={Number(businessState?.overdue_obligations_count ?? 0)}
        daysLeft={daysLeft}
        profileIncomplete={businessProfile ? !businessProfile.business_profile_completed : false}
      />

      {businessState && (
        <GlassCard className="mt-6 p-5 sm:p-6" hoverLift={false}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">Состояние бизнеса</p>
              <p className="mt-1 font-headline text-lg font-bold text-on-surface">Состояние бизнеса</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Выручка и расходы за месяц, прибыль и обязательства — единый снимок для операций.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  businessState.financial_health_status === 'ok'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : businessState.financial_health_status === 'warning'
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                      : 'bg-red-500/15 text-red-700 dark:text-red-300'
                }`}
              >
                {businessState.financial_health_status === 'ok'
                  ? 'Норма'
                  : businessState.financial_health_status === 'warning'
                    ? 'Внимание'
                    : 'Риск'}
              </span>
              <div className="text-right text-sm">
                <p className="text-on-surface-variant">Месяц: доход {fmt(businessState.monthly_revenue)} · расход {fmt(businessState.monthly_expenses)}</p>
                <p className="font-semibold text-on-surface">Прибыль (всего): {fmt(businessState.profit)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-outline-variant/20 pt-4 text-sm">
            <span className="text-on-surface-variant">
              К оплате: <strong className="text-on-surface">{businessState.pending_obligations_count}</strong>
            </span>
            <span className="text-on-surface-variant">
              Просрочено:{' '}
              <strong className={businessState.overdue_obligations_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-on-surface'}>
                {businessState.overdue_obligations_count}
              </strong>
            </span>
          </div>
        </GlassCard>
      )}

      <OnboardingChecklist />

      <div className="mt-8">
        <AIRecommendationPanel metrics={metrics} transactions={transactions} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 dark:bg-black/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Дальше</span>
        <Link to="/accounting" className="btn-secondary min-h-10 px-4 text-xs font-bold">
          Журнал
        </Link>
        <Link to="/bank" className="btn-secondary min-h-10 px-4 text-xs font-bold">
          Банк
        </Link>
        <Link to="/reports" className="btn-ghost min-h-10 px-3 text-xs font-bold text-primary">
          Отчётность
        </Link>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Денежный пульс</p>
        <Suspense fallback={<div className="h-52 rounded-3xl border border-outline/30 bg-surface-container-low/40 animate-pulse dark:border-white/[0.06]" aria-hidden />}>
          <CashflowPulse chartData={chartData} theme={theme} tipStyle={tipStyle} axisMuted={axisMuted} />
        </Suspense>
      </div>

      {/* Налоги и журнал */}
      <div className="mt-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <div className="page-section flex-1">
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
            <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/12 to-transparent p-6 backdrop-blur-md">
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

        <div className="page-section col-span-12 overflow-hidden bg-surface/80 p-0 dark:bg-transparent lg:col-span-8">
          <div className="flex flex-col gap-2 border-b border-outline/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
            <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Последние операции</h3>
            <Link to="/accounting" className="text-sm font-bold text-emerald-600 hover:underline dark:text-emerald-400">
              Все операции
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="px-4 py-10 sm:px-8">
              <PremiumEmptyState
                variant="compact"
                icon="receipt_long"
                title="Журнал пуст"
                description="Добавьте первую операцию — здесь появится поток."
                actions={
                  <Link to="/accounting" className="btn-primary min-h-11 px-6 text-sm font-bold">
                    Открыть журнал
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-emerald-500/[0.06] sm:px-8 sm:py-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${
                        tx.type === 'income' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}
                    >
                      <Icon name={tx.type === 'income' ? 'arrow_downward' : 'arrow_upward'} filled />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{tx.description || (tx.type === 'income' ? 'Доход' : 'Расход')}</p>
                      <p className="text-[10px] uppercase tracking-tight text-on-surface-variant">{tx.transaction_date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-headline text-sm font-extrabold ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface'}`}>
                      {tx.type === 'income' ? '+' : '−'}
                      {fmt(tx.amount)} BYN
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[9px] ${
                        tx.type === 'income'
                          ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border border-outline-variant/30 bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {tx.status === 'draft' ? 'Черновик' : 'Проведён'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
