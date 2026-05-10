import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { dashboardApi, reportsApi, demoApi } from '../api/client'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import ClientJourneyPanel from '../components/dashboard/ClientJourneyPanel'

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

/** FinClick Premium — акцент для диаграмм */
const CHART_BRAND = '#00a86b'

function MetricWaveDecor({ variant }: { variant: 'primary' | 'expense' | 'balance' | 'violet' }) {
  const waveClass =
    variant === 'primary'
      ? 'text-primary'
      : variant === 'expense'
        ? 'text-red-500'
        : variant === 'balance'
          ? 'text-emerald-600'
          : 'text-violet-500'
  return (
    <svg className={`pointer-events-none absolute bottom-0 left-0 right-0 h-14 opacity-[0.22] ${waveClass}`} viewBox="0 0 400 56" preserveAspectRatio="none" aria-hidden>
      <path fill="currentColor" d="M0 40 Q80 18 160 28 T320 22 T400 30 V56 H0 Z" />
      <path fill="white" className="opacity-[0.35]" d="M0 48 Q100 32 200 38 T400 34 V56 H0 Z" />
    </svg>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const isManager = (user?.role || '').toLowerCase() === 'manager'
  const qc = useQueryClient()
  const { data: metrics, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getMetrics().then((r) => r.data),
    enabled: !isManager,
    retry: 1,
  })

  const seedMutation = useMutation({
    mutationFn: () => demoApi.seed(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary-dashboard'] })
    },
  })

  const { data: txData } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => dashboardApi.getTransactions({ per_page: 5 }).then((r) => r.data),
    enabled: !isManager,
  })

  const dashboardYear = new Date().getFullYear()
  const { data: summaryData } = useQuery({
    queryKey: ['monthly-summary-dashboard', dashboardYear],
    queryFn: () => reportsApi.monthlySummary(dashboardYear).then((r) => r.data),
    enabled: !isManager,
  })

  const chartData = (summaryData?.months ?? [])
    .filter((m: any) => m.income > 0 || m.expense > 0)
    .map((m: any) => ({ month: m.label, income: m.income, expense: m.expense }))

  const transactions = txData?.items ?? []

  if (!isManager && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <Icon name="hourglass_empty" className="animate-spin" />
          <span className="font-headline font-medium">Загружаем данные...</span>
        </div>
      </div>
    )
  }

  if (!isManager && isError) {
    return (
      <div className="max-w-3xl">
        <div className="card-elevated p-6">
          <h1 className="page-heading">Главная</h1>
          <p className="mt-2 text-on-surface-variant">
            Не удалось загрузить данные дашборда. Проверьте подключение к API и повторите попытку.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => refetch()}>
            Повторить
          </button>
        </div>
      </div>
    )
  }

  const deadline = metrics?.next_tax_deadline
  const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null

  const quickLinks = [
    { to: '/scanner', icon: 'document_scanner', label: 'Сканер', color: 'from-emerald-50 to-teal-50 text-[#004d40] ring-emerald-100/90' },
    { to: '/documents', icon: 'description', label: 'Документы', color: 'from-teal-50 to-emerald-50 text-[#004d40] ring-teal-100' },
    { to: '/currency', icon: 'currency_exchange', label: 'Курсы НБ', color: 'from-[#ecfdf7] to-emerald-50 text-[#004d40] ring-emerald-100' },
    { to: '/reporting', icon: 'assignment_turned_in', label: 'Отчётность', color: 'from-[#e8faf4] to-teal-50 text-[#004d40] ring-teal-100/80' },
    { to: '/calendar', icon: 'calendar_today', label: 'Календарь', color: 'from-emerald-50/90 to-[#f0fdf9] text-[#004d40] ring-emerald-100' },
    { to: '/counterparties', icon: 'handshake', label: 'Контрагенты', color: 'from-teal-50 to-cyan-50 text-[#004d40] ring-teal-100' },
    { to: '/settings', icon: 'gavel', label: 'Законы', color: 'from-surface-container-low to-emerald-50/40 text-[#1e403a] ring-outline/80' },
  ] as const

  if (isManager) {
    return (
      <div className="fc-page-shell-tight">
        <div className="fc-hero">
          <div className="fc-hero-strip" aria-hidden />
          <h1 className="page-heading">Главная</h1>
          <p className="mt-2 text-on-surface-variant">Виджет менеджера: новые задачи, сканы и отчёты команды.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link to="/scan" className="card-elevated p-5 hover:bg-surface-container-low">
            <p className="font-semibold">Загрузить скан</p>
            <p className="mt-1 text-sm text-on-surface-variant">Камера или файл документа</p>
          </Link>
          <Link to="/planner" className="card-elevated p-5 hover:bg-surface-container-low">
            <p className="font-semibold">Создать задачу</p>
            <p className="mt-1 text-sm text-on-surface-variant">Поручение собственнику/бухгалтеру</p>
          </Link>
          <Link to="/planner" className="card-elevated p-5 hover:bg-surface-container-low">
            <p className="font-semibold">Подготовить отчёт</p>
            <p className="mt-1 text-sm text-on-surface-variant">Ответить на запрос в планере</p>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="fc-page-shell">
      {/* Header */}
      <div className="fc-hero flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="fc-hero-strip" aria-hidden />
        <div className="relative z-[1] flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-heading">Главная</h1>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              УСН · Беларусь · {new Date().toLocaleDateString('ru-BY', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="page-actions sm:w-auto sm:flex-row sm:gap-3">
            <Link to="/documents" className="btn-secondary !py-2.5 text-sm">
              <Icon name="file_download" className="text-lg" />
              Экспорт
            </Link>
          </div>
        </div>
      </div>

      <OnboardingChecklist />
      <ClientJourneyPanel metrics={metrics} transactions={transactions} />

      {/* Умные действия */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/assistant"
          className="group relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-[#003d36] via-[#00695c] to-[#008f7a] p-6 text-white shadow-lift ring-1 ring-white/10 transition duration-300 hover:brightness-[1.03]"
        >
          <div className="relative z-[1] max-w-[78%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">Умные действия</p>
            <h2 className="mt-2 font-headline text-xl font-bold tracking-tight">Спросить ИИ</h2>
            <p className="mt-1.5 text-sm leading-snug text-white/78">Подсказки по учёту, УСН и срокам — в контексте вашей организации.</p>
            <span className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-100 underline-offset-4 group-hover:underline">
              Подробнее
            </span>
          </div>
          <Icon name="smart_toy" className="pointer-events-none absolute -bottom-3 -right-1 text-[6.5rem] leading-none text-white/[0.09]" filled />
        </Link>
        <Link
          to="/planner"
          className="group relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-[#022f29] via-[#045648] to-[#00796b] p-6 text-white shadow-lift ring-1 ring-white/10 transition duration-300 hover:brightness-[1.03]"
        >
          <div className="relative z-[1] flex max-w-[78%] flex-col">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">Задачи</p>
            <h2 className="mt-2 font-headline text-xl font-bold tracking-tight">Планёр</h2>
            <p className="mt-1.5 text-sm leading-snug text-white/78">Поручения команде, отчёты и напоминания в одном месте.</p>
            <span className="mt-4 inline-flex min-h-10 items-center justify-center self-start rounded-full bg-white/15 px-5 text-sm font-semibold ring-1 ring-white/25 transition group-hover:bg-white/22">
              Открыть планёр
            </span>
          </div>
          <div className="pointer-events-none absolute -bottom-2 -right-2 flex h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-white/10">
            <Icon name="task_alt" className="text-[4.5rem] text-white/35" filled />
          </div>
        </Link>
      </div>

      {/* Быстрые сервисы — мобильный super-app ряд */}
      <div className="-mx-1 lg:hidden">
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-primary/70">Быстрый доступ</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickLinks.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className={`flex min-w-[4.75rem] flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br p-3 shadow-soft ring-1 ${q.color}`}
            >
              <Icon name={q.icon} className="text-2xl opacity-90" />
              <span className="text-center text-[10px] font-bold leading-tight text-[#0d302a]">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Tax deadline alert */}
      {daysLeft !== null && daysLeft <= 7 && (
        <div className={`flex items-center gap-4 px-6 py-4 rounded-xl border ${
          daysLeft <= 1
            ? 'bg-error/10 border-error/30'
            : 'bg-primary/5 border-primary/20'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            daysLeft <= 1 ? 'bg-error/20' : 'bg-primary/10'
          }`}>
            <Icon name={daysLeft <= 1 ? 'warning' : 'schedule'} className={daysLeft <= 1 ? 'text-error' : 'text-primary'} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">
              {daysLeft <= 0
                ? 'Сегодня крайний срок уплаты налогов!'
                : daysLeft === 1
                  ? 'Завтра крайний срок уплаты налогов!'
                  : `До дедлайна по налогам осталось ${daysLeft} дн.`}
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Срок: {deadline} · УСН к уплате: {fmt(metrics?.tax_usn_quarter)} BYN
            </p>
          </div>
        </div>
      )}

      {/* Metric Blades */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {(
          [
            {
              label: 'Доходы / мес',
              value: metrics?.income_current_month,
              icon: 'trending_up',
              accent: 'bg-primary',
              iconBg: 'bg-primary/12',
              iconClass: 'text-primary',
              wave: 'primary' as const,
            },
            {
              label: 'Расходы / мес',
              value: metrics?.expense_current_month,
              icon: 'trending_down',
              accent: 'bg-red-500',
              iconBg: 'bg-red-50',
              iconClass: 'text-red-600',
              wave: 'expense' as const,
            },
            {
              label: 'Баланс',
              value: metrics?.balance_current_month,
              icon: 'account_balance_wallet',
              accent: 'bg-emerald-600',
              iconBg: 'bg-emerald-50',
              iconClass: 'text-emerald-700',
              wave: 'balance' as const,
            },
            {
              label: 'В банке',
              value: metrics?.bank_balance,
              icon: 'credit_card',
              accent: 'bg-[#5b7cff]',
              iconBg: 'bg-violet-50',
              iconClass: 'text-violet-700',
              wave: 'violet' as const,
            },
          ] as const
        ).map((m) => (
          <div key={m.label} className="metric-blade group rounded-[1.25rem] pb-8 pt-5">
            <div className={`absolute bottom-0 left-0 top-0 w-1 ${m.accent} opacity-90`} />
            <MetricWaveDecor variant={m.wave} />
            <div className="relative z-[1] mb-3 flex items-start justify-between sm:mb-4">
              <span className="label !mb-0 text-[9px] sm:text-[10px]">{m.label}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${m.iconBg} shadow-xs ring-1 ring-black/[0.04]`}>
                <Icon name={m.icon} className={`text-lg ${m.iconClass}`} />
              </div>
            </div>
            <p className="relative z-[1] font-headline text-lg font-extrabold text-on-surface sm:text-2xl">
              {fmt(m.value)} <span className="text-xs font-normal text-on-surface-variant sm:text-sm">BYN</span>
            </p>
          </div>
        ))}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Chart */}
        <div className="page-section col-span-12 bg-surface p-4 dark:border-outline/45 sm:p-6 lg:col-span-8 lg:p-8">
          <div className="mb-4 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Доходы и расходы</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-xs text-on-surface-variant font-medium">Доходы</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-error" />
                <span className="text-xs text-on-surface-variant font-medium">Расходы</span>
              </div>
            </div>
          </div>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_BRAND} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={CHART_BRAND} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: 12,
                  fontSize: 13,
                  color: '#18181b',
                  boxShadow: '0 4px 24px -4px rgba(0,0,0,0.1)',
                }}
                formatter={(v: number) => [`${v.toLocaleString('ru')} BYN`]}
              />
              <Area type="monotone" dataKey="income" name="Доходы" stroke={CHART_BRAND} strokeWidth={2} fill="url(#gi)" />
              <Area type="monotone" dataKey="expense" name="Расходы" stroke="#dc2626" strokeWidth={2} fill="url(#ge)" />
            </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Taxes sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="page-section flex-1 bg-surface p-4 dark:border-outline/45 sm:p-6">
            <h3 className="label mb-6 flex items-center gap-2">
              <Icon name="calculate" className="text-primary text-lg" />
              Налоги к уплате
            </h3>
            <div className="space-y-5">
              {[
                { name: 'УСН 6%', amount: metrics?.tax_usn_quarter ?? 0, due: true },
                { name: 'НДС (0/10/20%)', amount: metrics?.tax_vat_month ?? 0, due: true },
                { name: 'ФСЗН 34%', amount: metrics?.tax_fsszn_quarter ?? 0, due: false },
              ].map((tax) => (
                <div key={tax.name}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-on-surface font-medium">{tax.name}</span>
                    <span className="font-bold text-on-surface">{fmt(tax.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tax.due ? 'bg-error' : 'bg-secondary'}`}
                      style={{ width: tax.due ? '70%' : '100%' }}
                    />
                  </div>
                  <p className="text-[10px] mt-1 text-on-surface-variant">
                    {tax.due ? 'К уплате' : 'Уплачен'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {deadline && (
            <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 rounded-xl border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <Icon name="event" filled className="text-primary" />
                <span className="text-sm font-bold text-primary">Ближайший дедлайн</span>
              </div>
              <p className="text-2xl font-extrabold font-headline text-on-surface">{deadline}</p>
              {daysLeft !== null && (
                <p className="text-xs text-on-surface-variant mt-1">
                  {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} осталось
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="page-section col-span-12 overflow-hidden bg-surface p-0 dark:border-outline/45">
          <div className="flex flex-col gap-2 border-b border-outline/55 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
            <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Последние операции</h3>
            <Link to="/transactions" className="text-sm font-bold text-primary hover:underline">
              Все операции
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="empty-state py-12">
              <Icon name="receipt_long" className="text-4xl text-on-surface-variant/30" />
              <p className="text-on-surface-variant text-sm mt-3">Операций пока нет</p>
              <button
                className="btn-primary mt-4"
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate()}
              >
                <Icon name="auto_awesome" className="text-lg" />
                {seedMutation.isPending ? 'Генерируем...' : 'Заполнить тестовыми данными'}
              </button>
              {seedMutation.isSuccess && (
                <p className="text-secondary text-xs mt-2">Данные созданы! Обновите страницу.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/5">
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-surface-container-high sm:px-8 sm:py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center ${
                      tx.type === 'income' ? 'text-secondary' : 'text-error'
                    }`}>
                      <Icon name={tx.type === 'income' ? 'arrow_downward' : 'arrow_upward'} filled />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{tx.description || (tx.type === 'income' ? 'Доход' : 'Расход')}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">{tx.transaction_date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-extrabold font-headline ${tx.type === 'income' ? 'text-secondary' : 'text-on-surface'}`}>
                      {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)} BYN
                    </p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md ${
                      tx.type === 'income'
                        ? 'bg-secondary/5 text-secondary border border-secondary/20'
                        : 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
                    }`}>
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
