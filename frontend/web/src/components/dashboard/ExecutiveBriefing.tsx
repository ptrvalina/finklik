import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { HealthMetrics } from '../premium-os/FinancialHealthWidget'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

type MonthRow = { label: string; income: number; expense: number }

function buildParagraphs(
  metrics: HealthMetrics | undefined,
  months: MonthRow[],
  draftCount: number,
  bankConnected: boolean,
): string[] {
  const income = Number(metrics?.income_current_month ?? 0)
  const expense = Number(metrics?.expense_current_month ?? 0)
  const pendingOcr = Number(metrics?.documents_pending_ocr ?? 0)
  const txMonth = Number(metrics?.transactions_this_month ?? 0)

  const paras: string[] = []

  const filled = months.filter((m) => m.income > 0 || m.expense > 0)
  if (filled.length >= 2) {
    const last = filled[filled.length - 1]
    const prev = filled[filled.length - 2]
    if (prev.income > 0) {
      const pct = Math.round(((last.income - prev.income) / prev.income) * 100)
      if (Math.abs(pct) >= 3) {
        paras.push(
          pct >= 0
            ? `Выручка по месяцам выросла примерно на ${pct}% относительно предыдущего периода.`
            : `Выручка по месяцам снизилась примерно на ${Math.abs(pct)}% — отследите крупные расходы и дебиторку.`,
        )
      }
    }
    if (prev.expense > 0 && last.expense > 0) {
      const epct = Math.round(((last.expense - prev.expense) / prev.expense) * 100)
      if (Math.abs(epct) >= 8) {
        paras.push(
          epct > 0
            ? `Расходы выросли на ${epct}% к прошлому месяцу — проверьте категории и разовые платежи.`
            : `Расходы снизились на ${Math.abs(epct)}% — хороший момент для резерва или инвестиций в рост.`,
        )
      }
    }
  }

  if (income > 0 && expense > 0) {
    const ratio = expense / income
    if (ratio > 0.95) {
      paras.push('Маржа месяца под давлением: расходы близки к доходам — контролируйте ликвидность перед налогами.')
    } else if (ratio < 0.55) {
      paras.push('Операционная маржа комфортная: расходы умеренные относительно выручки.')
    }
  }

  if (draftCount > 0) {
    paras.push(`${draftCount} ${draftCount === 1 ? 'операция остаётся' : 'операций остаются'} в черновиках — это искажает отчётность и прогноз.`)
  }

  if (pendingOcr > 0) {
    paras.push(`${pendingOcr} ${pendingOcr === 1 ? 'документ ждёт' : 'документов ждут'} распознавания в очереди OCR.`)
  }

  if (!bankConnected) {
    paras.push('Расчётные счета не подключены — без синхронизации банка картина ликвидности неполная.')
  }

  if (txMonth === 0 && income === 0 && expense === 0) {
    paras.push('Добавьте операции или импортируйте выписку — командный центр строит прогнозы только на реальных данных.')
  }

  if (paras.length === 0) {
    paras.push('Финансовый контур стабилен. Следите за дедлайнами и актуальностью журнала — мы продолжим мониторинг.')
  }

  return paras.slice(0, 1)
}

export function ExecutiveBriefing({
  metrics,
  months,
  draftCount,
  bankConnected,
}: {
  metrics: HealthMetrics | undefined
  months: MonthRow[]
  draftCount: number
  bankConnected: boolean
}) {
  const paragraphs = buildParagraphs(metrics, months, draftCount, bankConnected)

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 32 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-emerald-400/20 bg-gradient-to-br from-[rgb(var(--color-surface)/0.92)] via-emerald-500/[0.07] to-cyan-500/[0.06] p-6 shadow-[0_24px_80px_-40px_rgba(16,185,129,0.35)] backdrop-blur-xl dark:from-[rgb(var(--color-surface)/0.55)] dark:via-emerald-950/40 dark:to-[#0a1620]/90 sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.14),transparent_55%)]" aria-hidden />
      <div className="pointer-events-none absolute -left-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden />

      <div className="relative z-[1]">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-600/95 dark:text-emerald-400/90">Исполнительное резюме</p>
        <h2 className="mt-2 font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">День в цифрах</h2>
        <motion.p
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 300, damping: 28 }}
          className="mt-5 border-l-2 border-emerald-500/40 pl-4 text-base leading-relaxed text-on-surface/95 sm:text-[1.05rem]"
        >
          {paragraphs[0]}
        </motion.p>

        <div className="mt-8 flex flex-wrap gap-2 border-t border-white/[0.06] pt-6">
          <Link
            to="/accounting/journal"
            className="btn-primary inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-sm font-bold"
          >
            <Icon name="edit_note" className="text-lg" />
            Журнал
          </Link>
          <Link to="/scan" className="btn-secondary inline-flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-bold">
            <Icon name="document_scanner" className="text-lg" />
            Сканер
          </Link>
        </div>
      </div>
    </motion.section>
  )
}
