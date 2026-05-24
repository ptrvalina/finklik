import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { automationApi, reportsApi } from '../api/client'
import { Link } from 'react-router-dom'
import OperationalPage from '../components/shell/OperationalPage'
import { ExecutionTopActionBanner } from '../components/execution/ExecutionTopActionBanner'
import { orgQueryKey } from '../lib/queryKeys'
import { useThemeStore } from '../store/themeStore'
import { LineSkeleton, PremiumEmptyState, TableSkeleton } from '../components/premium'
import { InsightCard, RecommendationCard, WarningCard } from '../components/premium-os'

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

const CAT_COLORS: Record<string, string> = {
  salary: 'bg-primary', rent: 'bg-tertiary', materials: 'bg-secondary',
  marketing: 'bg-error', taxes: 'bg-amber-500', utilities: 'bg-indigo-400',
  transport: 'bg-orange-400', office: 'bg-sky-400', services: 'bg-violet-400',
  other: 'bg-outline-variant',
}

export default function AnalyticsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const theme = useThemeStore((s) => s.theme)
  const tipStyle = useMemo(
    () => ({
      background: theme === 'dark' ? 'rgba(12,24,36,0.94)' : 'rgba(255,255,255,0.96)',
      border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(226,232,240,0.95)',
      borderRadius: 14,
      fontSize: 13,
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      boxShadow: theme === 'dark' ? '0 24px 48px -12px rgba(0,0,0,0.65)' : '0 16px 40px -12px rgba(0,77,64,0.15)',
      backdropFilter: 'blur(12px)',
    }),
    [theme],
  )
  const axisFill = theme === 'dark' ? '#94a3b8' : '#64748b'

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: orgQueryKey(['monthly-summary', year]),
    queryFn: () => reportsApi.monthlySummary(year).then(r => r.data),
  })

  const { data: catData } = useQuery({
    queryKey: orgQueryKey('expense-categories'),
    queryFn: () => reportsApi.expenseCategories().then(r => r.data),
  })
  const { data: automationKpi } = useQuery({
    queryKey: orgQueryKey('automation-kpi'),
    queryFn: () => automationApi.kpi().then((r) => r.data),
  })
  const { data: dataQuality } = useQuery({
    queryKey: orgQueryKey('automation-data-quality'),
    queryFn: () => automationApi.dataQuality().then((r) => r.data),
  })

  const monthlyData = (summary?.months ?? []).map((m: any) => ({
    ...m,
    profit: m.income - m.expense,
  }))

  const totalIncome = summary?.total_income ?? 0
  const totalExpense = summary?.total_expense ?? 0
  const totalProfit = summary?.profit ?? 0
  const margin = totalIncome > 0 ? (totalProfit / totalIncome * 100).toFixed(1) : '0'
  const categories = catData?.items ?? []

  return (
    <OperationalPage
      eyebrow="Контроль"
      title="Аналитика"
      description={`Динамика, структура расходов и рекомендации за ${year} год.`}
      primaryAction={
        <Link to="/reports" className="btn-primary w-full sm:w-auto">
          <Icon name="assignment_turned_in" className="text-lg" /> В отчётность
        </Link>
      }
      secondaryActions={
        <div className="flex rounded-full border border-outline/75 bg-surface-container-high p-1 shadow-soft">
          <button type="button" onClick={() => setYear((y) => y - 1)} className="tap-highlight-none px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface">
            <Icon name="chevron_left" className="text-sm" />
          </button>
          <span className="flex min-w-[3.5rem] items-center justify-center px-3 py-2 text-xs font-bold text-on-surface">{year}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} className="tap-highlight-none px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface">
            <Icon name="chevron_right" className="text-sm" />
          </button>
        </div>
      }
    >
      <ExecutionTopActionBanner className="mb-2" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 lg:gap-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="metric-blade">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="flex justify-between items-start mb-4">
            <span className="label !mb-0">Выручка (год)</span>
          </div>
          <p className="text-3xl font-extrabold font-headline text-on-surface">{fmt(totalIncome)} <span className="text-sm font-normal text-on-surface-variant">BYN</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="metric-blade">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-error" />
          <div className="flex justify-between items-start mb-4">
            <span className="label !mb-0">Расходы (год)</span>
          </div>
          <p className="text-3xl font-extrabold font-headline text-on-surface">{fmt(totalExpense)} <span className="text-sm font-normal text-on-surface-variant">BYN</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="metric-blade">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary" />
          <div className="flex justify-between items-start mb-4">
            <span className="label !mb-0">Чистая прибыль</span>
            <div className="flex items-center gap-1 text-secondary text-sm font-bold">
              {Number(margin) >= 0 ? <Icon name="trending_up" className="text-sm" /> : <Icon name="trending_down" className="text-sm" />}
              {margin}%
            </div>
          </div>
          <p className="text-3xl font-extrabold font-headline text-on-surface">{fmt(totalProfit)} <span className="text-sm font-normal text-on-surface-variant">BYN</span></p>
          <p className="mt-2 text-xs text-on-surface-variant">Рентабельность {margin}%</p>
        </motion.div>
      </div>
      {automationKpi && (
        <div className="page-section p-4 sm:p-6">
          <h3 className="mb-4 font-headline text-base font-bold text-on-surface sm:text-lg">Автоматизация: KPI</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: 'operations_auto_rate', label: 'Операции auto %' },
              { key: 'ocr_auto_rate', label: 'OCR без ручного %' },
              { key: 'reporting_ready_rate', label: 'Отчёты ready %' },
              { key: 'payroll_auto_rate', label: 'Payroll auto %' },
            ].map((m: any) => {
              const value = Number(automationKpi?.[m.key] ?? 0)
              const target = Number(automationKpi?.targets?.[m.key] ?? 0)
              const ok = value >= target
              return (
                <div
                  key={m.key}
                  className="rounded-2xl border border-outline/50 bg-surface/80 p-3 shadow-xs backdrop-blur-md transition hover:border-emerald-400/25 dark:border-white/[0.07] dark:bg-[rgb(var(--color-surface)/0.45)]"
                >
                  <p className="text-xs text-on-surface-variant">{m.label}</p>
                  <p className={`mt-1 text-lg font-extrabold ${ok ? 'text-secondary' : 'text-amber-500'}`}>{value.toFixed(1)}%</p>
                  <p className="text-[10px] text-on-surface-variant">target {target.toFixed(1)}%</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline/50 bg-surface/80 p-4 shadow-xs backdrop-blur-md dark:border-white/[0.07] dark:bg-[rgb(var(--color-surface)/0.45)]">
              <p className="text-xs text-on-surface-variant">Цикл operation → report ready</p>
              <p className="mt-1 text-lg font-extrabold text-on-surface">
                {Number(automationKpi?.cycle_hours_operation_to_report_ready ?? 0).toFixed(1)}ч
              </p>
            </div>
            <div className="rounded-2xl border border-outline/50 bg-surface/80 p-4 shadow-xs backdrop-blur-md dark:border-white/[0.07] dark:bg-[rgb(var(--color-surface)/0.45)]">
              <p className="text-xs text-on-surface-variant">Сокращение цикла</p>
              <p className={`mt-1 text-lg font-extrabold ${
                Number(automationKpi?.cycle_reduction_progress_x ?? 0) >= Number(automationKpi?.targets?.cycle_reduction_target_x ?? 3)
                  ? 'text-secondary'
                  : 'text-amber-500'
              }`}>
                x{Number(automationKpi?.cycle_reduction_progress_x ?? 0).toFixed(2)}
              </p>
              <p className="text-[10px] text-on-surface-variant">
                target x{Number(automationKpi?.targets?.cycle_reduction_target_x ?? 3).toFixed(1)}
              </p>
            </div>
          </div>
          {dataQuality && (
            <div className="mt-4 rounded-2xl border border-outline/50 bg-surface/80 p-4 shadow-xs backdrop-blur-md dark:border-white/[0.07] dark:bg-[rgb(var(--color-surface)/0.45)]">
              <p className="text-xs text-on-surface-variant">Контроль качества данных</p>
              <p className={`mt-1 text-sm font-bold ${dataQuality.status === 'ok' ? 'text-secondary' : 'text-amber-500'}`}>
                {dataQuality.status === 'ok' ? 'Данные консистентны' : 'Нужна проверка данных'}
              </p>
              <p className="text-[10px] text-on-surface-variant">
                дубли: {Number(dataQuality.duplicate_operations ?? 0)} / несогласованности: {Number(dataQuality.inconsistent_operations ?? 0)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <div className="page-section col-span-12 p-4 sm:p-6 lg:col-span-8 lg:p-8">
          <div className="mb-6 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Доходы и расходы по месяцам</h3>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
          {loadingSummary ? (
            <div
              className="flex h-[300px] flex-col justify-end gap-2 rounded-2xl border border-white/[0.06] bg-surface-container-low/20 p-4"
              aria-busy="true"
              aria-label="Загрузка графика"
            >
              <LineSkeleton className="max-w-[45%]" />
              <div className="flex h-[220px] items-end gap-1.5 pt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="fc-skeleton-shimmer flex-1 rounded-t-md"
                    style={{ height: `${30 + ((i * 19) % 58)}%` }}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="barIncomeG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="barExpenseG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fca5a5" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 10" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.25)'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v.toLocaleString('ru')} BYN`]} />
                <Bar dataKey="income" name="Доходы" fill="url(#barIncomeG)" radius={[8, 8, 0, 0]} opacity={0.92} />
                <Bar dataKey="expense" name="Расходы" fill="url(#barExpenseG)" radius={[8, 8, 0, 0]} opacity={0.88} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="col-span-12 flex flex-col gap-4 sm:gap-6 lg:col-span-4">
          <div className="page-section flex-1 border-emerald-500/[0.06] p-4 sm:p-6">
            <h3 className="label mb-6">Структура расходов</h3>
            {categories.length === 0 ? (
              <PremiumEmptyState
                variant="compact"
                icon="pie_chart"
                title="Структура расходов пока пуста"
                description="Добавьте операции с категориями — здесь появится распределение затрат."
                actions={
                  <Link to="/accounting/journal" className="btn-secondary text-xs">
                    Журнал операций
                  </Link>
                }
              />
            ) : (
              <div className="space-y-5">
                {categories.map((cat: any) => (
                  <div key={cat.category}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-on-surface font-medium">{cat.label}</span>
                      <span className="text-on-surface-variant">{cat.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full ${CAT_COLORS[cat.category] || 'bg-outline-variant'}`} style={{ width: `${cat.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalIncome > 0 && totalProfit > 0 ? (
            <InsightCard
              title={`Маржа ${margin}%`}
              action={
                <Link to="/accounting/journal" className="btn-secondary px-3 py-1.5 text-xs">
                  Журнал
                </Link>
              }
            >
              Рентабельность в зелёной зоне — усильте устойчивость резервом на 1–2 месяца расходов.
            </InsightCard>
          ) : totalIncome > 0 ? (
            <WarningCard
              title="Расходы давят на маржу"
              action={
                <Link to="/accounting/journal" className="btn-secondary px-3 py-1.5 text-xs">
                  Разбор
                </Link>
              }
            >
              Доход есть, но прибыль отрицательная — пересмотрите статьи затрат и контрагентов.
            </WarningCard>
          ) : (
            <RecommendationCard
              title="Нет данных для выводов"
              cta={
                <Link to="/accounting/journal" className="btn-primary px-4 py-2 text-sm">
                  Открыть журнал
                </Link>
              }
            >
              Добавьте операции — появятся маржа, структура расходов и подсказки по оптимизации.
            </RecommendationCard>
          )}
        </div>

        <div className="page-section col-span-12 overflow-hidden p-0">
          <CounterpartyTurnover />
        </div>

        <div className="page-section col-span-12 p-4 sm:p-6 lg:p-8">
          <h3 className="mb-6 font-headline text-base font-bold text-on-surface sm:mb-8 sm:text-lg">Прибыль по месяцам</h3>
          {loadingSummary ? (
            <div
              className="flex h-[220px] flex-col justify-center gap-3 rounded-2xl border border-white/[0.06] bg-surface-container-low/20 p-4"
              aria-busy="true"
              aria-label="Загрузка графика прибыли"
            >
              <LineSkeleton className="max-w-[40%]" />
              <div className="h-[140px] rounded-xl fc-skeleton-shimmer" aria-hidden />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="4%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="92%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 10" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.22)'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: axisFill }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v.toLocaleString('ru')} BYN`]} />
                <Area
                  type="natural"
                  dataKey="profit"
                  name="Прибыль"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#gp)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: '#10b981', stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </OperationalPage>
  )
}


function CounterpartyTurnover() {
  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('counterparty-turnover'),
    queryFn: () => reportsApi.counterpartyTurnover().then((r) => r.data),
  })

  const items = data?.items ?? []

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-outline-variant/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-8">
        <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Обороты по контрагентам</h3>
        <Link to="/accounting/journal" className="text-left text-sm font-bold text-primary hover:underline sm:text-right">
          Журнал операций
        </Link>
      </div>
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : items.length === 0 ? (
        <div className="p-4 sm:p-6">
          <PremiumEmptyState
            variant="compact"
            icon="handshake"
            title="Контрагенты не связаны с операциями"
            description="Укажите контрагента в журнале или при импорте — здесь появятся обороты и сальдо."
            actions={
              <>
                <Link to="/accounting/journal" className="btn-primary min-h-10 px-5 text-sm">
                  Журнал
                </Link>
                <Link to="/scan" className="btn-secondary min-h-10 px-5 text-sm">
                  Сканер
                </Link>
              </>
            }
          />
        </div>
      ) : (
        <div className="fc-premium-table overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="table-head-row">
                <th className="px-4 py-3 text-left sm:px-6 sm:py-4 lg:px-8">Контрагент</th>
                <th className="px-4 py-3 text-right sm:px-6 sm:py-4 lg:px-8">Доходы</th>
                <th className="px-4 py-3 text-right sm:px-6 sm:py-4 lg:px-8">Расходы</th>
                <th className="px-4 py-3 text-right sm:px-6 sm:py-4 lg:px-8">Сальдо</th>
                <th className="px-4 py-3 text-right sm:px-6 sm:py-4 lg:px-8">Операций</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {items.map((row: any) => (
                <tr key={row.counterparty_id} className="transition-colors hover:bg-surface-container-high">
                  <td className="px-4 py-3 text-sm font-bold text-on-surface sm:px-6 sm:py-4 lg:px-8">{row.name}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-secondary sm:px-6 sm:py-4 lg:px-8">+{fmt(row.income)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-error sm:px-6 sm:py-4 lg:px-8">−{fmt(row.expense)}</td>
                  <td className={`px-4 py-3 text-right font-headline text-sm font-extrabold sm:px-6 sm:py-4 lg:px-8 ${row.income - row.expense >= 0 ? 'text-secondary' : 'text-error'}`}>
                    {fmt(row.income - row.expense)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-on-surface-variant sm:px-6 sm:py-4 lg:px-8">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
