import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { operationsApi, reportsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../ui/MoneyAmount'
import { buildSparkline, computeMonthOverMonth } from '../../lib/dashboardOwnerMetrics'
import { terminology } from '../../i18n/terminology.ru'
import { useCountUp } from '../../hooks/useCountUp'

function riskStatusLabel(level: string | undefined | null): { text: string; className: string } {
  const l = (level || '').toLowerCase()
  if (l === 'critical' || l === 'high') {
    return { text: terminology.globalStatus.critical, className: 'bg-red-500/20 text-red-100 ring-1 ring-red-400/30' }
  }
  if (l === 'medium' || l === 'attention' || l === 'warn') {
    return { text: terminology.globalStatus.risk, className: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30' }
  }
  if (l === 'low' || l === 'ok' || l === 'normal') {
    return { text: 'Всё под контролем', className: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30' }
  }
  return { text: terminology.globalStatus.attention, className: 'bg-white/10 text-white/80' }
}

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
  const animatedCash = useCountUp(cashOnHand, 1100)

  const { data: summary } = useQuery({
    queryKey: orgQueryKey(['monthly-summary-dashboard', year]),
    queryFn: () => reportsApi.monthlySummary(year).then((r) => r.data),
    staleTime: 120_000,
  })

  const { data: fs } = useQuery({
    queryKey: orgQueryKey('financial-state-hero'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  })

  const risk = riskStatusLabel(fs?.risk_level as string | undefined)
  const sparkData = useMemo(() => buildSparkline(summary?.months), [summary])
  const mom = useMemo(() => computeMonthOverMonth(summary?.months), [summary])

  const currentMonth = useMemo(() => {
    const cm = new Date().getMonth() + 1
    return summary?.months?.find((m) => m.month === cm) ?? null
  }, [summary])

  const hasChart = sparkData.length >= 2
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  }, [])

  return (
    <motion.section
      className="fc-business-hero"
      aria-label="Финансовое состояние бизнеса"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="fc-business-hero-glow" aria-hidden />
      <div className="fc-business-hero-glow fc-business-hero-glow--left" aria-hidden />
      <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1">
          <motion.p
            className="text-xs font-medium text-white/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {greeting} · ФинКлик
          </motion.p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="font-label text-label-caps uppercase text-primary-fixed/80">Сводный остаток</p>
            <motion.span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${risk.className}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 22 }}
            >
              {risk.text}
            </motion.span>
          </div>
          <p className="mt-0.5 text-xs text-white/60">Деньги на счетах</p>
          {cashOnHand == null ? (
            <div className="mt-2">
              <p className="font-headline text-display-lg text-white/55">—</p>
              <Link
                to="/bank"
                className="mt-2 inline-flex min-h-9 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/25 hover:shadow-[0_0_24px_rgba(255,255,255,0.12)]"
              >
                Подключить расчётный счёт
              </Link>
            </div>
          ) : (
            <MoneyAmount
              value={animatedCash ?? cashOnHand}
              className="mt-1 font-headline text-display-lg text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
              symbolClassName="h-[0.55em] w-[0.48em] text-white"
            />
          )}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Поступления</p>
              <MoneyAmount
                value={currentMonth?.income ?? 0}
                emptyAsZero
                className="mt-0.5 text-sm font-bold text-emerald-100"
                symbolClassName="h-[0.7em] w-[0.6em] text-emerald-100"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Расходы</p>
              <MoneyAmount
                value={currentMonth?.expense ?? 0}
                emptyAsZero
                className="mt-0.5 text-sm font-bold text-red-100"
                symbolClassName="h-[0.7em] w-[0.6em] text-red-100"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Поток</p>
              <MoneyAmount
                value={mom?.currentNet ?? 0}
                emptyAsZero
                signed
                className="mt-0.5 text-sm font-bold text-white"
                symbolClassName="h-[0.7em] w-[0.6em] text-white"
              />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <DeltaLine label="К прошлому месяцу" value={mom?.delta ?? null} pct={mom?.pct ?? null} />
          </div>
        </div>

        <div className="fc-business-hero-chart shrink-0 lg:w-[220px] xl:w-[260px]">
          {hasChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroNetFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['auto', 'auto']} />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2.25}
                  fill="url(#heroNetFill)"
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full min-h-[88px] flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5 px-3 text-center">
              <span className="material-symbols-outlined text-2xl text-white/40" aria-hidden>
                show_chart
              </span>
              <p className="mt-1 text-xs font-medium text-white/55">График появится после операций</p>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  )
}
