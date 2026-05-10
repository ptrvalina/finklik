import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { GlassCard } from '../premium/GlassCard'

const CHART_BRAND = '#10b981'
const CHART_EXPENSE = '#f87171'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export function CashflowPulse({
  chartData,
  theme,
  tipStyle,
  axisMuted,
}: {
  chartData: { month: string; income: number; expense: number }[]
  theme: string
  tipStyle: Record<string, string | number>
  axisMuted: string
}) {
  const annotation = useMemo(() => {
    if (chartData.length < 2) return null
    const last = chartData[chartData.length - 1]
    const prev = chartData[chartData.length - 2]
    const netLast = last.income - last.expense
    const netPrev = prev.income - prev.expense
    const delta = netLast - netPrev
    if (Math.abs(delta) < 1) {
      return { tone: 'neutral' as const, text: 'Чистый поток стабилен относительно прошлого месяца.' }
    }
    if (delta > 0) {
      return { tone: 'positive' as const, text: `Чистый денежный поток улучшился примерно на ${delta.toLocaleString('ru-BY', { maximumFractionDigits: 0 })} BYN к прошлому месяцу.` }
    }
    return {
      tone: 'watch' as const,
      text: `Чистый поток сжался примерно на ${Math.abs(delta).toLocaleString('ru-BY', { maximumFractionDigits: 0 })} BYN — проверьте крупные списания.`,
    }
  }, [chartData])

  const lastRow = chartData.length > 0 ? chartData[chartData.length - 1] : null

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      <GlassCard className="relative overflow-hidden p-5 sm:p-8" hoverLift={false}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.35]">
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-emerald-500/[0.07] via-transparent to-transparent" aria-hidden />
          <div className="absolute -right-24 -top-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden />
        </div>

        <div className="relative z-[1] mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-600/90 dark:text-emerald-400/85">Денежный пульс</p>
            <h3 className="mt-1 font-headline text-xl font-bold text-on-surface sm:text-2xl">Доходы и расходы по месяцам</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">
              Органическая динамика потока: слои градиента показывают устойчивость и давление расходов.
            </p>
          </div>
          {annotation && (
            <div
              className={`flex max-w-md items-start gap-2 rounded-2xl border px-4 py-3 text-sm backdrop-blur-md ${
                annotation.tone === 'positive'
                  ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50'
                  : annotation.tone === 'watch'
                    ? 'border-amber-400/30 bg-amber-500/10 text-amber-50'
                    : 'border-white/10 bg-white/[0.06] text-on-surface-variant'
              }`}
            >
              <Icon name="insights" className="mt-0.5 flex-shrink-0 text-lg opacity-90" />
              <span>{annotation.text}</span>
            </div>
          )}
        </div>

        <div className="relative z-[1] h-[220px] sm:h-[300px]">
          <motion.div className="h-full w-full" initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
                <defs>
                  <linearGradient id="pulseIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_BRAND} stopOpacity={0.42} />
                    <stop offset="45%" stopColor={CHART_BRAND} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={CHART_BRAND} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pulseExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_EXPENSE} stopOpacity={0.38} />
                    <stop offset="50%" stopColor="#fb7185" stopOpacity={0.1} />
                    <stop offset="100%" stopColor={CHART_EXPENSE} stopOpacity={0} />
                  </linearGradient>
                  <filter id="pulseGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 12" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.22)'} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v.toLocaleString('ru-BY')} BYN`]} />
                <Area
                  type="natural"
                  dataKey="income"
                  name="Доходы"
                  stroke={CHART_BRAND}
                  strokeWidth={2.8}
                  fill="url(#pulseIncome)"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: CHART_BRAND, stroke: '#fff' }}
                  isAnimationActive
                  animationDuration={1200}
                />
                <Area
                  type="natural"
                  dataKey="expense"
                  name="Расходы"
                  stroke={CHART_EXPENSE}
                  strokeWidth={2.6}
                  fill="url(#pulseExpense)"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: CHART_EXPENSE, stroke: '#fff' }}
                  isAnimationActive
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="relative z-[1] mt-4 flex flex-wrap items-center gap-6 border-t border-white/[0.06] pt-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.65)]" />
            <span className="font-medium text-on-surface-variant">Доходы</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.45)]" />
            <span className="font-medium text-on-surface-variant">Расходы</span>
          </div>
          {lastRow && (
            <span className="text-on-surface-variant/90">
              Последний месяц: чистый поток{' '}
              <strong className="text-on-surface">
                {(lastRow.income - lastRow.expense).toLocaleString('ru-BY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} BYN
              </strong>
            </span>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}
