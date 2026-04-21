import { Link } from 'react-router-dom'

type MetricsLike = {
  bank_balance?: number
  tax_usn_quarter?: number
  tax_vat_month?: number
  next_tax_deadline?: string | null
}

type TxLike = {
  id: string
  status?: string
}

type JourneyAction = {
  id: string
  title: string
  description: string
  to: string
  cta: string
  priority: 'high' | 'medium' | 'low'
  icon: string
}

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

function buildJourney(metrics: MetricsLike | undefined, transactions: TxLike[]): JourneyAction[] {
  const deadline = metrics?.next_tax_deadline ? new Date(metrics.next_tax_deadline) : null
  const hasDeadline = deadline && !Number.isNaN(deadline.getTime())
  const daysLeft = hasDeadline ? Math.ceil((deadline!.getTime() - Date.now()) / 86400000) : null
  const hasDrafts = transactions.some((tx) => tx.status === 'draft')
  const noOps = transactions.length === 0
  const totalTax = Number(metrics?.tax_usn_quarter || 0) + Number(metrics?.tax_vat_month || 0)

  const actions: JourneyAction[] = []

  if (daysLeft !== null && daysLeft <= 7) {
    actions.push({
      id: 'tax-deadline',
      title: 'Скоро дедлайн налогов',
      description: daysLeft <= 0 ? 'Срок оплаты наступил, лучше отправить и оплатить сегодня.' : `До дедлайна осталось ${daysLeft} дн. Подготовьте подачу заранее.`,
      to: '/reporting',
      cta: 'Открыть отчётность',
      priority: 'high',
      icon: 'event_upcoming',
    })
  }

  if (hasDrafts) {
    actions.push({
      id: 'drafts',
      title: 'Есть черновики операций',
      description: 'Проведите черновики, чтобы отчёты и налоги считались из актуальных данных.',
      to: '/transactions',
      cta: 'Проверить операции',
      priority: 'medium',
      icon: 'edit_note',
    })
  }

  if (noOps) {
    actions.push({
      id: 'seed-flow',
      title: 'Начните с первого потока данных',
      description: 'Добавьте операции или загрузите документы, чтобы получить расчёты и аналитику.',
      to: '/scanner',
      cta: 'Открыть сканер',
      priority: 'medium',
      icon: 'document_scanner',
    })
  }

  if (totalTax > 0 && Number(metrics?.bank_balance || 0) < totalTax) {
    actions.push({
      id: 'balance-risk',
      title: 'Риск нехватки средств на налоги',
      description: 'Текущий баланс меньше суммы ближайших начислений. Проверьте входящие и план оплат.',
      to: '/bank',
      cta: 'Проверить баланс',
      priority: 'high',
      icon: 'warning',
    })
  }

  actions.push({
    id: 'assistant',
    title: 'Спросите ИИ по вашему кейсу',
    description: 'Уточните, что платить в этом месяце и какие документы нужны для сдачи.',
    to: '/assistant',
    cta: 'Открыть консультанта',
    priority: 'low',
    icon: 'smart_toy',
  })

  return actions.slice(0, 4)
}

function priorityStyles(priority: JourneyAction['priority']) {
  if (priority === 'high') return 'border-rose-200/80 bg-rose-50/70 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100'
  if (priority === 'medium') return 'border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100'
  return 'border-teal-200/80 bg-teal-50/70 text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-100'
}

export default function ClientJourneyPanel({
  metrics,
  transactions,
}: {
  metrics: MetricsLike | undefined
  transactions: TxLike[]
}) {
  const actions = buildJourney(metrics, transactions)

  return (
    <section className="card-elevated p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="label !mb-1">Логика клиента</p>
          <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Что делать сейчас</h2>
        </div>
        <span className="rounded-full border border-outline/80 bg-surface-container-low px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
          Автоприоритет
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <article key={action.id} className={`rounded-2xl border p-4 ${priorityStyles(action.priority)}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 ring-1 ring-black/5 dark:bg-white/10">
                <Icon name={action.icon} className="text-xl" />
              </div>
              <span className="rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                {action.priority === 'high' ? 'Критично' : action.priority === 'medium' ? 'Важно' : 'Планово'}
              </span>
            </div>
            <h3 className="text-sm font-bold">{action.title}</h3>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{action.description}</p>
            <Link to={action.to} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline">
              {action.cta}
              <Icon name="arrow_forward" className="text-base" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
