import { useId } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '../premium/GlassCard'

export type HealthMetrics = {
  bank_balance?: number
  tax_usn_quarter?: number
  tax_vat_month?: number
  tax_fsszn_quarter?: number
  next_tax_deadline?: string | null
  income_current_month?: number
  expense_current_month?: number
  balance_current_month?: number
  transactions_this_month?: number
  documents_pending_ocr?: number
}

type TxLike = { status?: string }

function computeScore(metrics: HealthMetrics | undefined, transactions: TxLike[]) {
  let score = 88
  const drafts = transactions.filter((t) => t.status === 'draft').length
  const noOps = transactions.length === 0
  const totalTax = Number(metrics?.tax_usn_quarter || 0) + Number(metrics?.tax_vat_month || 0)
  const balance = Number(metrics?.bank_balance || 0)
  const pendingOcr = Number(metrics?.documents_pending_ocr || 0)
  const deadline = metrics?.next_tax_deadline ? new Date(metrics.next_tax_deadline) : null
  const hasDeadline = deadline && !Number.isNaN(deadline.getTime())
  const daysLeft = hasDeadline ? Math.ceil((deadline!.getTime() - Date.now()) / 86400000) : null

  if (noOps) score -= 22
  if (drafts > 0) score -= Math.min(14, 6 + drafts * 2)
  if (pendingOcr > 0) score -= Math.min(10, 4 + pendingOcr * 2)
  if (totalTax > 0 && balance < totalTax) score -= 18
  if (daysLeft !== null && daysLeft <= 14 && daysLeft > 7) score -= 6
  if (daysLeft !== null && daysLeft <= 7) score -= 12
  if (daysLeft !== null && daysLeft <= 0) score -= 8

  return Math.max(12, Math.min(100, Math.round(score)))
}

function aiHealthSummary(metrics: HealthMetrics | undefined, score: number): string {
  const income = Number(metrics?.income_current_month ?? 0)
  const expense = Number(metrics?.expense_current_month ?? 0)
  const ratio = income > 0 ? expense / income : expense > 0 ? 1.25 : 0
  const balance = Number(metrics?.bank_balance ?? 0)
  const taxSlice = Number(metrics?.tax_usn_quarter ?? 0) + Number(metrics?.tax_vat_month ?? 0)

  if (score >= 82) {
    if (ratio < 0.65 && income > 0) return 'Доходы покрывают расходы с комфортным запасом — хороший запас прочности.'
    return 'Показатели в зелёной зоне: держите черновики и сроки под контролем.'
  }
  if (score >= 64) {
    if (ratio > 0.92 && income > 0) return 'Доля расходов высокая относительно выручки — проверьте категории и крупные платежи.'
    if (balance < taxSlice && taxSlice > 0) return 'Остаток на счетах может не покрыть ближайшие налоги — запланируйте пополнение.'
    return 'Есть точечные отставания: закройте черновики и документы в очереди OCR.'
  }
  if (ratio > 1 && income > 0) return 'Расходы превышают доходы за период — стоит пересмотреть ликвидность и отложенные обязательства.'
  return 'Требуется внимание к ликвидности и операционному контуру — начните с срочных задач выше.'
}

function tone(score: number): { label: string; bar: string } {
  if (score >= 82) return { label: 'Уверенный режим', bar: 'from-emerald-400 to-teal-300' }
  if (score >= 64) return { label: 'Стабильно', bar: 'from-teal-400 to-emerald-500' }
  if (score >= 42) return { label: 'Нужно внимание', bar: 'from-amber-400 to-orange-400' }
  return { label: 'Есть риски', bar: 'from-rose-400 to-orange-500' }
}

export function FinancialHealthWidget({
  metrics,
  transactions,
}: {
  metrics: HealthMetrics | undefined
  transactions: TxLike[]
}) {
  const gradId = useId().replace(/:/g, '')
  const score = computeScore(metrics, transactions)
  const { label, bar } = tone(score)
  const summaryLine = aiHealthSummary(metrics, score)
  const income = Number(metrics?.income_current_month ?? 0)
  const expense = Number(metrics?.expense_current_month ?? 0)
  const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : expense > 0 ? 100 : 0
  const liquidityCover =
    Number(metrics?.tax_usn_quarter ?? 0) + Number(metrics?.tax_vat_month ?? 0) > 0
      ? Number(metrics?.bank_balance ?? 0) /
        (Number(metrics?.tax_usn_quarter ?? 0) + Number(metrics?.tax_vat_month ?? 0) + 0.01)
      : null

  return (
    <GlassCard className="relative overflow-hidden p-6 sm:p-8" hoverLift>
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">Финансовое здоровье</p>
          <h3 className="mt-2 font-headline text-xl font-bold tracking-tight text-on-surface">Индекс устойчивости</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">{summaryLine}</p>
        </div>
        <div className="relative flex shrink-0 items-center justify-center">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" className="stroke-white/[0.08] dark:stroke-white/[0.1]" strokeWidth="10" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={`url(#healthGrad-${gradId})`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={264}
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - (264 * score) / 100 }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
            <defs>
              <linearGradient id={`healthGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-headline text-3xl font-bold tracking-tight text-on-surface">{score}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">из 100</span>
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Доход / мес', v: `${income.toLocaleString('ru-BY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
          { k: 'Расход / мес', v: `${expense.toLocaleString('ru-BY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
          { k: 'Доля расходов', v: `${expenseRatio}%` },
          {
            k: 'Ликвидность × налог',
            v: liquidityCover != null ? `${liquidityCover >= 1 ? '≥1×' : `${liquidityCover.toFixed(2)}×`}` : '—',
          },
        ].map((row) => (
          <div key={row.k} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 dark:bg-black/15">
            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">{row.k}</p>
            <p className="mt-1 font-headline text-sm font-bold text-on-surface">{row.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-on-surface">{label}</span>
          <span className="text-on-surface-variant">{score >= 70 ? 'Спокойный сценарий' : 'Проверьте задачи ниже'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06] dark:bg-white/[0.08]">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 26 }}
          />
        </div>
      </div>
    </GlassCard>
  )
}
