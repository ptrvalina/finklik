import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { reportsApi } from '../api/client'

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

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  fontSize: 13,
  color: '#18181b',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)',
}

export default function AnalyticsPage() {
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['monthly-summary', year],
    queryFn: () => reportsApi.monthlySummary(year).then(r => r.data),
  })

  const { data: catData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => reportsApi.expenseCategories().then(r => r.data),
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
    <div className="max-w-7xl space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">Аналитика</h1>
          <p className="mt-1 text-sm text-zinc-500">Финансовые показатели за {year} год</p>
        </div>
        <div className="flex w-full justify-start sm:w-auto sm:justify-end">
          <div className="flex rounded-md border border-zinc-200/80 bg-surface-container-high p-1 shadow-soft">
            <button type="button" onClick={() => setYear((y) => y - 1)} className="tap-highlight-none px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface sm:py-1.5">
              <Icon name="chevron_left" className="text-sm" />
            </button>
            <span className="flex min-w-[3.5rem] items-center justify-center px-3 py-2 text-xs font-bold text-on-surface sm:py-1.5">{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} className="tap-highlight-none px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface sm:py-1.5">
              <Icon name="chevron_right" className="text-sm" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div className="metric-blade">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="flex justify-between items-start mb-4">
            <span className="label !mb-0">Выручка (год)</span>
          </div>
          <p className="text-3xl font-extrabold font-headline text-on-surface">{fmt(totalIncome)} <span className="text-sm font-normal text-on-surface-variant">BYN</span></p>
        </div>

        <div className="metric-blade">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-error" />
          <div className="flex justify-between items-start mb-4">
            <span className="label !mb-0">Расходы (год)</span>
          </div>
          <p className="text-3xl font-extrabold font-headline text-on-surface">{fmt(totalExpense)} <span className="text-sm font-normal text-on-surface-variant">BYN</span></p>
        </div>

        <div className="metric-blade">
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
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <div className="col-span-12 rounded-xl border border-zinc-200/80 bg-surface-container-low p-4 shadow-soft sm:p-6 lg:col-span-8 lg:p-8">
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
            <div className="h-[300px] flex items-center justify-center text-on-surface-variant text-sm">Загружаем...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString('ru')} BYN`]} />
                <Bar dataKey="income" name="Доходы" fill="#0d9488" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar dataKey="expense" name="Расходы" fill="#dc2626" radius={[4, 4, 0, 0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="col-span-12 flex flex-col gap-4 sm:gap-6 lg:col-span-4">
          <div className="flex-1 rounded-xl border border-zinc-200/80 bg-surface-container-high p-4 shadow-soft sm:p-6">
            <h3 className="label mb-6">Структура расходов</h3>
            {categories.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Нет данных по расходам</p>
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

          <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/10 to-transparent p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="auto_awesome" filled className="text-primary" />
              <span className="text-sm font-bold text-primary">Insight AI</span>
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              {totalIncome > 0 && totalProfit > 0
                ? `Рентабельность ${margin}% — выше среднего по отрасли. Рекомендуем увеличить резервный фонд.`
                : totalIncome > 0
                  ? 'Расходы превышают доходы. Рекомендуем пересмотреть структуру затрат.'
                  : 'Добавьте транзакции для получения аналитических рекомендаций.'}
            </p>
          </div>
        </div>

        <div className="col-span-12 overflow-hidden rounded-xl border border-zinc-200/80 bg-surface-container-low shadow-soft">
          <CounterpartyTurnover />
        </div>

        <div className="col-span-12 rounded-xl border border-zinc-200/80 bg-surface-container-low p-4 shadow-soft sm:p-6 lg:p-8">
          <h3 className="mb-6 font-headline text-base font-bold text-on-surface sm:mb-8 sm:text-lg">Прибыль по месяцам</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString('ru')} BYN`]} />
              <Area type="monotone" dataKey="profit" name="Прибыль" stroke="#0d9488" strokeWidth={2} fill="url(#gp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}


function CounterpartyTurnover() {
  const { data, isLoading } = useQuery({
    queryKey: ['counterparty-turnover'],
    queryFn: () => reportsApi.counterpartyTurnover().then((r) => r.data),
  })

  const items = data?.items ?? []

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-outline-variant/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-8">
        <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Обороты по контрагентам</h3>
        <button type="button" className="text-left text-sm font-bold text-primary hover:underline sm:text-right">
          Подробнее
        </button>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-on-surface-variant text-sm">Загружаем...</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center">
          <Icon name="handshake" className="text-4xl text-on-surface-variant/30" />
          <p className="text-on-surface-variant text-sm mt-3">Нет данных. Привяжите контрагентов к операциям.</p>
        </div>
      ) : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant bg-surface-container-high/50">
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
