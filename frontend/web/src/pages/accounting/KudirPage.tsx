import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, documentsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../../components/ui/MoneyAmount'
import { PremiumEmptyState, TableSkeleton } from '../../components/premium'

type TxRow = {
  id: string
  transaction_date: string
  type: string
  amount: number
  category?: string
  description?: string
}

const TYPE_LABEL: Record<string, string> = {
  income: 'Доход',
  expense: 'Расход',
  refund: 'Возврат',
  writeoff: 'Списание',
}

function yearBounds(y: number) {
  return { date_from: `${y}-01-01`, date_to: `${y}-12-31` }
}

export default function KudirPage() {
  const now = new Date().getFullYear()
  const [year, setYear] = useState(now)
  const range = yearBounds(year)

  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey(['kudir', year]),
    queryFn: () =>
      dashboardApi
        .getTransactions({ date_from: range.date_from, date_to: range.date_to, limit: 500 })
        .then((r) => r.data as { items?: TxRow[] }),
  })

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return items
      .filter((t) => ['income', 'expense', 'refund', 'writeoff'].includes(t.type))
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
  }, [data])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of rows) {
      const amt = Number(t.amount) || 0
      if (t.type === 'income') income += amt
      else expense += amt
    }
    return { income, expense, profit: income - expense }
  }, [rows])

  async function exportCsv() {
    const { data: blob } = await documentsApi.transactionsCsv(range.date_from, range.date_to)
    const url = URL.createObjectURL(new Blob([blob]))
    const a = document.createElement('a')
    a.href = url
    a.download = `kudir-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/accounting" className="btn-ghost !px-0 !text-xs text-on-surface-variant">
            ← Учёт
          </Link>
          <h1 className="page-heading mt-2">Книга учёта доходов и расходов</h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Доходы и расходы за период — на основе операций журнала. Для правок откройте журнал.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/journal" className="btn-secondary text-sm">
            Журнал
          </Link>
          <button type="button" className="btn-primary text-sm" onClick={() => void exportCsv()} disabled={rows.length === 0}>
            Скачать CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Год</span>
          <select className="input mt-1 min-h-11 w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now, now - 1, now - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Доходы</p>
          <MoneyAmount value={totals.income} className="mt-1 font-headline text-xl font-extrabold text-secondary" />
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Расходы</p>
          <MoneyAmount value={totals.expense} className="mt-1 font-headline text-xl font-extrabold text-on-surface" />
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Итого</p>
          <MoneyAmount value={totals.profit} signed className="mt-1 font-headline text-xl font-extrabold text-primary" />
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-outline/20 px-4 py-3 sm:px-6">
          <h2 className="font-headline text-base font-bold text-on-surface">Записи за {year}</h2>
          <p className="text-xs text-on-surface-variant">{rows.length} операций</p>
        </div>
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} className="p-4" />
        ) : rows.length === 0 ? (
          <div className="p-8">
            <PremiumEmptyState
              variant="compact"
              icon="menu_book"
              title="Записей пока нет"
              description="Добавьте доходы и расходы в журнале — они появятся в книге."
              actions={
                <Link to="/accounting/journal" className="btn-primary min-h-11 px-5 text-sm">
                  Открыть журнал
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Описание</th>
                  <th className="px-4 py-3">Категория</th>
                  <th className="px-4 py-3 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-outline/10">
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{row.transaction_date}</td>
                    <td className="px-4 py-3 text-xs">{TYPE_LABEL[row.type] || row.type}</td>
                    <td className="px-4 py-3">{row.description || '—'}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{row.category || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <MoneyAmount
                        value={row.type === 'income' ? row.amount : -row.amount}
                        signed
                        className="inline-flex justify-end"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
