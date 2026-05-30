import { Link } from 'react-router-dom'

type Tx = {
  id: string
  type?: string
  description?: string
  transaction_date?: string
  amount?: number | string
  status?: string
}

function fmt(n: number | string | undefined): string {
  return Number(n || 0).toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function eventMeta(tx: Tx): { icon: string; tone: string; why: string } {
  if (tx.status === 'draft') {
    return {
      icon: 'edit_note',
      tone: 'text-amber-700 dark:text-amber-300',
      why: 'Черновик — проведите, чтобы попал в отчётность',
    }
  }
  if (tx.type === 'income') {
    return { icon: 'arrow_downward', tone: 'text-emerald-600 dark:text-emerald-400', why: 'Поступление проведено' }
  }
  return { icon: 'arrow_upward', tone: 'text-on-surface-variant', why: 'Расход проведён' }
}

/**
 * Лента важных событий на главной — «что произошло и почему важно»,
 * вместо сырого списка транзакций. Работает на уже загруженных данных.
 */
export default function DashboardTimeline({ transactions }: { transactions: Tx[] }) {
  const items = (transactions ?? []).slice(0, 5)

  return (
    <section className="fc-surface-calm p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Что произошло</p>
        <Link to="/accounting/journal" className="text-xs font-semibold text-primary hover:underline">
          Все операции
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Пока тихо. Отсканируйте документ или добавьте операцию — события появятся здесь.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((tx) => {
            const meta = eventMeta(tx)
            return (
              <li key={tx.id} className="flex items-start gap-3">
                <span
                  className={`material-symbols-outlined mt-0.5 shrink-0 text-lg ${meta.tone}`}
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {tx.description || (tx.type === 'income' ? 'Доход' : 'Расход')}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {tx.transaction_date ? `${tx.transaction_date} · ` : ''}
                    {meta.why}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '−'}
                  {fmt(tx.amount)} BYN
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
