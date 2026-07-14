import { Link } from 'react-router-dom'
import { GlassCard } from '../premium/GlassCard'
import type { HealthMetrics } from './FinancialHealthWidget'

type TxLike = { id?: string; status?: string }

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

type Rec = { id: string; text: string; to: string; hint: string }

function buildRecs(metrics: HealthMetrics | undefined, transactions: TxLike[]): Rec[] {
  const out: Rec[] = []
  const drafts = transactions.filter((t) => t.status === 'draft').length
  const pendingOcr = Number(metrics?.documents_pending_ocr ?? 0)
  const totalTax = Number(metrics?.tax_usn_quarter || 0) + Number(metrics?.tax_vat_month || 0)
  const balance = Number(metrics?.bank_balance || 0)
  const deadline = metrics?.next_tax_deadline ? new Date(metrics.next_tax_deadline) : null
  const hasDeadline = deadline && !Number.isNaN(deadline.getTime())
  const daysLeft = hasDeadline ? Math.ceil((deadline!.getTime() - Date.now()) / 86400000) : null

  if (pendingOcr > 0) {
    out.push({
      id: 'ocr',
      text: `${pendingOcr} документов ждут OCR — извлеките суммы и контрагентов`,
      to: '/scan',
      hint: 'Сканер',
    })
  }
  if (drafts > 0) {
    out.push({
      id: 'drafts',
      text: `${drafts} операций в черновиках могут исказить отчётность`,
      to: '/accounting/journal',
      hint: 'Провести в журнале',
    })
  }
  if (daysLeft !== null && daysLeft <= 14) {
    out.push({
      id: 'tax',
      text: daysLeft <= 0 ? 'Проверьте налоговый дедлайн — срок мог наступить' : `До налогового срока осталось ${daysLeft} дн.`,
      to: '/reports',
      hint: 'Отчётность',
    })
  }
  if (totalTax > 0 && balance < totalTax) {
    out.push({
      id: 'liquidity',
      text: 'Ликвидность ниже ближайших налоговых начислений',
      to: '/bank',
      hint: 'Банк и поток',
    })
  }
  if (transactions.length === 0) {
    out.push({
      id: 'empty',
      text: 'Нет операций — добавьте проводку или документ, чтобы дашборд был показательным',
      to: '/scan',
      hint: 'Скан',
    })
  }

  return out.slice(0, 1)
}

export function AIRecommendationPanel({
  metrics,
  transactions,
}: {
  metrics: HealthMetrics | undefined
  transactions: TxLike[]
}) {
  const recs = buildRecs(metrics, transactions)

  if (recs.length === 0) {
    return (
      <GlassCard className="p-6 sm:p-7" hoverLift={false}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">Сигналы</p>
        <p className="mt-2 text-sm leading-snug text-on-surface-variant">
          По текущим данным срочных действий не требуется.
        </p>
      </GlassCard>
    )
  }

  const r = recs[0]
  return (
    <GlassCard className="p-6 sm:p-7" hoverLift>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600/90 dark:text-emerald-400/90">Следующий шаг</p>
      <Link
        to={r.to}
        className="group mt-3 flex gap-3 rounded-2xl border border-outline/45 bg-surface/40 px-3.5 py-3 transition hover:border-emerald-400/35 hover:bg-surface/70 dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
      >
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <Icon name="auto_awesome" className="text-xl" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-on-surface">{r.text}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline">
            {r.hint}
            <Icon name="arrow_forward" className="text-base" />
          </span>
        </span>
      </Link>
    </GlassCard>
  )
}
