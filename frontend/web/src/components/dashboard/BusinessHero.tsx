import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { dashboardApi, reportsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../ui/MoneyAmount'
import {
  buildSparkline,
  computeMonthOverMonth,
  dateDaysAgo,
  sumNetFromTransactions,
} from '../../lib/dashboardOwnerMetrics'

function DeltaLine({ label, value, pct }: { label: string; value: number | null; pct?: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <p className="text-sm text-white/70">
        {label}: <span className="font-semibold text-white/90">—</span>
      </p>
    )
  }
  const positive = value >= 0
  const pctStr = pct != null && Number.isFinite(pct) ? ` (${positive ? '+' : ''}${pct.toFixed(0)}%)` : ''
  return (
    <p className="text-sm text-white/85">
      {label}:{' '}
      <span className={`font-bold tabular-nums ${positive ? 'text-emerald-200' : 'text-red-200'}`}>
        <MoneyAmount value={value} signed className="inline-flex text-inherit" symbolClassName="h-[0.75em] w-[0.65em] text-inherit" />
        {pctStr}
      </span>
    </p>
  )
}

export default function BusinessHero({ cashOnHand }: { cashOnHand: number | null }) {
  const year = new Date().getFullYear()

  const { data: metrics } = useQuery({
    queryKey: orgQueryKey('dashboard'),
    queryFn: () => dashboardApi.getMetrics().then((r) => r.data),
    staleTime: 45_000,
  })

  const { data: summary } = useQuery({
    queryKey: orgQueryKey(['monthly-summary-dashboard', year]),
    queryFn: () => reportsApi.monthlySummary(year).then((r) => r.data),
    staleTime: 120_000,
  })

  const { data: tx30 } = useQuery({
    queryKey: orgQueryKey(['transactions-30d']),
    queryFn: () =>
      dashboardApi
        .getTransactions({ per_page: 100, date_from: dateDaysAgo(30) })
        .then((r) => r.data),
    staleTime: 60_000,
  })

  const sparkData = useMemo(() => buildSparkline(summary?.months), [summary])
  const mom = useMemo(() => computeMonthOverMonth(summary?.months), [summary])

  const net30 = useMemo(() => {
    const fromTx = sumNetFromTransactions(tx30?.items)
    if (fromTx !== 0 || (tx30?.items?.length ?? 0) > 0) return fromTx
    const fallback = Number(metrics?.balance_current_month)
    return Number.isFinite(fallback) ? fallback : null
  }, [tx30, metrics])

  const hasChart = sparkData.length >= 2

  return (
    <section className="fc-business-hero" aria-label="Финансовое состояние бизнеса">
      <div className="fc-business-hero-glow" aria-hidden />
      <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/75">Деньги на счетах</p>
          <MoneyAmount
            value={cashOnHand ?? 0}
            emptyAsZero
            className="mt-1 font-headline text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
            symbolClassName="h-[0.55em] w-[0.48em] text-white"
          />
          <div className="mt-3 space-y-1">
            <DeltaLine label="Изменение за 30 дней" value={net30} />
            <DeltaLine
              label="К прошлому месяцу"
              value={mom?.delta ?? null}
              pct={mom?.pct ?? null}
            />
          </div>
        </div>

        <div className="fc-business-hero-chart shrink-0 lg:w-[220px] xl:w-[260px]">
          {hasChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroNetFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['auto', 'auto']} />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                  fill="url(#heroNetFill)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full min-h-[88px] flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5 px-3 text-center">
              <span className="material-symbols-outlined text-2xl text-white/40" aria-hidden>
                show_chart
              </span>
              <p className="mt-1 text-xs font-medium text-white/55">Нет данных для графика</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
