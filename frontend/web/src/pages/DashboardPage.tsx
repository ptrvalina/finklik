import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { motion } from 'framer-motion'
import { dashboardApi, reportsApi, demoApi } from '../api/client'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist'
import ClientJourneyPanel from '../components/dashboard/ClientJourneyPanel'
import { GlassCard } from '../components/premium/GlassCard'

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

/** Liquid analytics accent — emerald brand */
const CHART_BRAND = '#10b981'
const CHART_EXPENSE = '#f87171'

function MetricWaveDecor({ variant }: { variant: 'primary' | 'expense' | 'balance' | 'violet' }) {
  const waveClass =
    variant === 'primary'
      ? 'text-emerald-500'
      : variant === 'expense'
        ? 'text-red-400'
        : variant === 'balance'
          ? 'text-teal-400'
          : 'text-violet-400'
  return (
    <svg className={`pointer-events-none absolute bottom-0 left-0 right-0 h-16 opacity-[0.28] ${waveClass}`} viewBox="0 0 400 56" preserveAspectRatio="none" aria-hidden>
      <path fill="currentColor" d="M0 40 Q80 14 160 26 T320 18 T400 28 V56 H0 Z" />
      <path fill="white" className="opacity-[0.2] dark:opacity-[0.08]" d="M0 48 Q100 30 200 36 T400 32 V56 H0 Z" />
    </svg>
  )
}

function BankCardFan() {
  const cards = [
    { bank: 'Беларусбанк', last4: '4821', grad: 'from-emerald-600/90 to-teal-900' },
    { bank: 'Приорбанк', last4: '9033', grad: 'from-[#004d40] to-emerald-800' },
    { bank: 'Альфа-Банк', last4: '7712', grad: 'from-slate-800 to-emerald-950' },
  ]
  return (
    <div className="relative mx-auto h-[200px] max-w-md sm:h-[220px]">
      {cards.map((c, i) => (
        <motion.div
          key={c.bank}
          initial={false}
          whileHover={{ y: -6, rotate: 0, zIndex: 30 }}
          className="absolute left-1/2 top-4 w-[min(92%,280px)] -translate-x-1/2 cursor-pointer rounded-2xl border border-white/15 bg-gradient-to-br p-4 shadow-float ring-1 ring-white/10"
          style={{
            transform: `translateX(-50%) rotate(${-8 + i * 8}deg) translateY(${i * 14}px)`,
            zIndex: 10 + i,
          }}
        >
          <div className={`h-24 rounded-xl bg-gradient-to-br ${c.grad} p-3 text-white shadow-inner`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">{c.bank}</p>
            <p className="mt-4 font-headline text-lg tracking-[0.25em]">•••• {c.last4}</p>
            <p className="mt-2 text-[10px] text-white/60">Демо-карта · синхронизация в «Банк»</p>
          </div>
        </motion.div>
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[rgb(var(--color-canvas))] to-transparent dark:from-[#07111a]" />
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const theme = useThemeStore((s) => s.theme)
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
      <div className="flex h-64 items-center justify-center">
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

  const quickLinks = [
    { to: '/scanner', icon: 'document_scanner', label: 'Сканер', color: 'from-emerald-100/90 to-teal-50 text-[#004d40] ring-emerald-200/80' },
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
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-600/90 dark:text-emerald-400/90">Command center</p>
            <h1 className="page-heading mt-1">Главная</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
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

      {/* HERO AI — animated orb + Ask AI */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-[#004d40] via-[#065f46] to-[#022c22] p-6 shadow-float ring-1 ring-white/10 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <motion.div
          className="pointer-events-none absolute right-8 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-gradient-to-br from-emerald-300 to-cyan-300 opacity-90 shadow-[0_0_60px_rgba(52,211,153,0.55)]"
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-[1] max-w-[min(100%,520px)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/90">AI-native</p>
          <h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-white sm:text-3xl">Спросите ИИ о ваших финансах</h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-50/85">
            УСН, КУДиР, сроки и контекст организации — консультант знает ваши данные и подскажет следующий шаг.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['УСН 6%', 'КУДиР', 'Банк', 'Контрагенты'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-emerald-50/95 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            to="/assistant"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-headline text-sm font-bold text-[#004d40] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] transition hover:brightness-105"
          >
            <Icon name="smart_toy" className="text-xl text-emerald-700" filled />
            Открыть консультанта
          </Link>
        </div>
      </motion.div>

      <OnboardingChecklist />
      <ClientJourneyPanel metrics={metrics} transactions={transactions} />

      {/* Smart pulse feed */}
      <div className="grid gap-3 sm:grid-cols-3">
        {daysLeft !== null && daysLeft <= 14 && (
          <Link
            to="/taxes"
            className="group rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/15 to-transparent p-4 shadow-soft backdrop-blur-md transition hover:border-amber-400/40"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              <Icon name="schedule" className="text-lg" />
              Налоги
            </div>
            <p className="mt-2 font-headline text-sm font-semibold text-on-surface">
              {daysLeft <= 0 ? 'Дедлайн сегодня' : `Осталось ${daysLeft} дн.`}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">{deadline}</p>
          </Link>
        )}
        <Link
          to="/transactions"
          className="rounded-3xl border border-outline/50 bg-surface/70 p-4 shadow-soft backdrop-blur-xl transition hover:border-emerald-400/30 dark:border-white/[0.06] dark:bg-[rgb(var(--color-surface)/0.4)]"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <Icon name="edit_note" className="text-lg text-primary" />
            Черновики
          </div>
          <p className="mt-2 font-headline text-2xl font-bold text-on-surface">{draftCount}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Операций требуют проверки</p>
        </Link>
        <Link
          to="/bank"
          className="rounded-3xl border border-outline/50 bg-surface/70 p-4 shadow-soft backdrop-blur-xl transition hover:border-emerald-400/30 dark:border-white/[0.06] dark:bg-[rgb(var(--color-surface)/0.4)]"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <Icon name="account_balance" className="text-lg text-primary" />
            Банк
          </div>
          <p className="mt-2 font-headline text-sm font-semibold text-on-surface">Синхронизация</p>
          <p className="mt-1 text-xs text-on-surface-variant">Карты и выписки · мульти-банк</p>
        </Link>
      </div>

      {/* Planner shortcut row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Link
          to="/planner"
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#022f29] via-[#064e3b] to-[#0f766e] p-6 text-white shadow-lift ring-1 ring-white/10 transition duration-300 hover:brightness-[1.04]"
        >
          <div className="relative z-[1] max-w-[85%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">Команда</p>
            <h2 className="mt-2 font-headline text-xl font-bold tracking-tight">Планёр задач</h2>
            <p className="mt-1.5 text-sm leading-snug text-white/78">Поручения, отчёты и напоминания — без потери контекста.</p>
            <span className="mt-4 inline-flex min-h-10 items-center justify-center self-start rounded-full bg-white/15 px-5 text-sm font-semibold ring-1 ring-white/25 transition group-hover:bg-white/22">
              Открыть планёр
            </span>
          </div>
          <Icon name="task_alt" className="pointer-events-none absolute -bottom-2 -right-2 text-[5rem] text-white/[0.08]" filled />
        </Link>

        {/* Bank cards showcase */}
        <GlassCard className="p-6" hoverLift={false}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-headline text-base font-bold text-on-surface">Карты организации</h3>
            <Link to="/bank" className="text-xs font-bold text-primary hover:underline">
              Управление
            </Link>
          </div>
          <BankCardFan />
        </GlassCard>
      </div>

      {/* Quick services mobile */}
      <div className="-mx-1 lg:hidden">
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80">Быстрый доступ</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickLinks.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className={`flex min-w-[4.75rem] flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br p-3 shadow-soft ring-1 ${q.color}`}
            >
              <Icon name={q.icon} className="text-2xl opacity-90" />
              <span className="text-center text-[10px] font-bold leading-tight text-[#0d302a] dark:text-emerald-50">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Tax deadline banner */}
      {daysLeft !== null && daysLeft <= 7 && (
        <div
          className={`flex items-center gap-4 rounded-3xl border px-6 py-4 backdrop-blur-md ${
            daysLeft <= 1 ? 'border-red-400/30 bg-red-500/10' : 'border-emerald-400/25 bg-emerald-500/10'
          }`}
        >
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${daysLeft <= 1 ? 'bg-red-500/20' : 'bg-emerald-500/15'}`}
          >
            <Icon name={daysLeft <= 1 ? 'warning' : 'schedule'} className={daysLeft <= 1 ? 'text-red-400' : 'text-emerald-500'} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">
              {daysLeft <= 0
                ? 'Сегодня крайний срок уплаты налогов!'
                : daysLeft === 1
                  ? 'Завтра крайний срок уплаты налогов!'
                  : `До дедлайна по налогам осталось ${daysLeft} дн.`}
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Срок: {deadline} · УСН к уплате: {fmt(metrics?.tax_usn_quarter)} BYN
            </p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              label: 'Доходы / мес',
              value: metrics?.income_current_month,
              icon: 'trending_up',
              accent: 'bg-emerald-500',
              iconBg: 'bg-emerald-500/15',
              iconClass: 'text-emerald-600 dark:text-emerald-400',
              wave: 'primary' as const,
            },
            {
              label: 'Расходы / мес',
              value: metrics?.expense_current_month,
              icon: 'trending_down',
              accent: 'bg-red-500',
              iconBg: 'bg-red-500/15',
              iconClass: 'text-red-600 dark:text-red-400',
              wave: 'expense' as const,
            },
            {
              label: 'Баланс',
              value: metrics?.balance_current_month,
              icon: 'account_balance_wallet',
              accent: 'bg-teal-500',
              iconBg: 'bg-teal-500/15',
              iconClass: 'text-teal-700 dark:text-teal-300',
              wave: 'balance' as const,
            },
            {
              label: 'В банке',
              value: metrics?.bank_balance,
              icon: 'credit_card',
              accent: 'bg-violet-500',
              iconBg: 'bg-violet-500/15',
              iconClass: 'text-violet-700 dark:text-violet-300',
              wave: 'violet' as const,
            },
          ] as const
        ).map((m) => (
          <motion.div
            key={m.label}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="metric-blade group pb-9 pt-6"
          >
            <div className={`absolute bottom-0 left-0 top-0 w-1 ${m.accent} opacity-95 shadow-[0_0_12px_rgba(16,185,129,0.35)]`} />
            <MetricWaveDecor variant={m.wave} />
            <div className="relative z-[1] mb-3 flex items-start justify-between sm:mb-4">
              <span className="label !mb-0 text-[9px] sm:text-[10px]">{m.label}</span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.iconBg} shadow-xs ring-1 ring-white/10`}>
                <Icon name={m.icon} className={`text-lg ${m.iconClass}`} />
              </div>
            </div>
            <p className="relative z-[1] font-headline text-lg font-extrabold text-on-surface sm:text-2xl">
              {fmt(m.value)} <span className="text-xs font-normal text-on-surface-variant sm:text-sm">BYN</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Bento */}
      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 p-5 sm:p-8 lg:col-span-7" hoverLift={false}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface">Денежный поток</h3>
              <p className="text-xs text-on-surface-variant">Органичная динамика доходов и расходов</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                <span className="text-xs font-medium text-on-surface-variant">Доходы</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.45)]" />
                <span className="text-xs font-medium text-on-surface-variant">Расходы</span>
              </div>
            </div>
          </div>
          <div className="h-[240px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="3%" stopColor={CHART_BRAND} stopOpacity={0.35} />
                    <stop offset="92%" stopColor={CHART_BRAND} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="3%" stopColor={CHART_EXPENSE} stopOpacity={0.28} />
                    <stop offset="92%" stopColor={CHART_EXPENSE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 12" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.25)'} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v.toLocaleString('ru')} BYN`]} />
                <Area
                  type="natural"
                  dataKey="income"
                  name="Доходы"
                  stroke={CHART_BRAND}
                  strokeWidth={2.5}
                  fill="url(#gi)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: CHART_BRAND, stroke: '#fff' }}
                />
                <Area
                  type="natural"
                  dataKey="expense"
                  name="Расходы"
                  stroke={CHART_EXPENSE}
                  strokeWidth={2.5}
                  fill="url(#ge)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: CHART_EXPENSE, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <div className="col-span-12 flex flex-col gap-6 lg:col-span-5">
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

        <div className="page-section col-span-12 overflow-hidden bg-surface/80 p-0 dark:bg-transparent">
          <div className="flex flex-col gap-2 border-b border-outline/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
            <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Последние операции</h3>
            <Link to="/transactions" className="text-sm font-bold text-emerald-600 hover:underline dark:text-emerald-400">
              Все операции
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="empty-state py-12">
              <Icon name="receipt_long" className="text-4xl text-on-surface-variant/30" />
              <p className="mt-3 text-sm text-on-surface-variant">Операций пока нет</p>
              <button className="btn-primary mt-4" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
                <Icon name="auto_awesome" className="text-lg" />
                {seedMutation.isPending ? 'Генерируем...' : 'Заполнить тестовыми данными'}
              </button>
              {seedMutation.isSuccess && <p className="mt-2 text-xs text-secondary">Данные созданы! Обновите страницу.</p>}
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
