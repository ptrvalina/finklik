import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, documentsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../../components/ui/MoneyAmount'
import { PremiumEmptyState, TableSkeleton } from '../../components/premium'
import AccountingNavTabs from '../../components/accounting/AccountingNavTabs'

type TxRow = {
  id: string
  transaction_date: string
  type: string
  amount: number
  category?: string
  description?: string
  status?: string
}

const INCOME_TYPES = new Set(['income', 'refund'])
const EXPENSE_TYPES = new Set(['expense', 'writeoff'])

function yearBounds(y: number) {
  return { date_from: `${y}-01-01`, date_to: `${y}-12-31` }
}

function quarterOf(dateStr: string) {
  const m = new Date(dateStr).getMonth()
  return Math.floor(m / 3) + 1
}

function KudirTable({
  rows,
  section,
  startIndex,
}: {
  rows: TxRow[]
  section: 'income' | 'expense'
  startIndex: number
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-on-surface-variant sm:px-6">
        {section === 'income' ? 'Доходов за период пока нет.' : 'Расходов за период пока нет.'}
      </p>
    )
  }

  let qTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const row of rows) {
    const q = quarterOf(row.transaction_date)
    qTotals[q] += Number(row.amount) || 0
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="table-head-row">
            <th className="w-12 px-4 py-3">№</th>
            <th className="px-4 py-3">Дата</th>
            <th className="px-4 py-3">Содержание операции</th>
            <th className="px-4 py-3">Категория / документ</th>
            <th className="px-4 py-3 text-right">Сумма, BYN</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="border-t border-outline/10">
              <td className="px-4 py-3 text-xs tabular-nums text-on-surface-variant">{startIndex + i + 1}</td>
              <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">{row.transaction_date}</td>
              <td className="px-4 py-3">{row.description || '—'}</td>
              <td className="px-4 py-3 text-xs text-on-surface-variant">{row.category || '—'}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                <MoneyAmount value={row.amount} className="inline-flex justify-end" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-outline/20 bg-surface-container-low/50">
            <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-on-surface-variant">
              Итого по кварталам
            </td>
            <td className="px-4 py-2 text-right text-xs tabular-nums">
              {[1, 2, 3, 4].map((q) => (
                <div key={q} className="text-on-surface-variant">
                  Q{q}: <MoneyAmount value={qTotals[q]} className="inline font-semibold text-on-surface" />
                </div>
              ))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
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

  const posted = useMemo(() => {
    const items = data?.items ?? []
    return items
      .filter((t) => t.status !== 'draft' && (INCOME_TYPES.has(t.type) || EXPENSE_TYPES.has(t.type)))
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
  }, [data])

  const incomeRows = useMemo(() => posted.filter((t) => INCOME_TYPES.has(t.type)), [posted])
  const expenseRows = useMemo(() => posted.filter((t) => EXPENSE_TYPES.has(t.type)), [posted])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of incomeRows) income += Number(t.amount) || 0
    for (const t of expenseRows) expense += Number(t.amount) || 0
    return { income, expense, profit: income - expense }
  }, [incomeRows, expenseRows])

  const draftCount = useMemo(() => (data?.items ?? []).filter((t) => t.status === 'draft').length, [data])

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
      <AccountingNavTabs />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-heading">Книга учёта доходов и расходов</h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            КУДиР для ИП на УСН в РБ: раздел I — доходы, раздел II — расходы. Записи формируются из{' '}
            <strong className="font-semibold text-on-surface">проведённых</strong> операций журнала.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/journal" className="btn-secondary text-sm">
            Журнал
          </Link>
          <button type="button" className="btn-primary text-sm" onClick={() => void exportCsv()} disabled={posted.length === 0}>
            Скачать CSV
          </button>
        </div>
      </div>

      {draftCount > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {draftCount} {draftCount === 1 ? 'черновик не попадёт' : 'черновиков не попадут'} в книгу, пока не нажмёте{' '}
          <Link to="/accounting/journal?filter=drafts" className="font-semibold underline">
            «Провести» в журнале
          </Link>
          .
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Налоговый год</span>
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
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Раздел I · доходы</p>
          <MoneyAmount value={totals.income} className="mt-1 font-headline text-xl font-extrabold text-secondary" />
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Раздел II · расходы</p>
          <MoneyAmount value={totals.expense} className="mt-1 font-headline text-xl font-extrabold text-on-surface" />
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Финансовый результат</p>
          <MoneyAmount value={totals.profit} signed className="mt-1 font-headline text-xl font-extrabold text-primary" />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} className="p-4" />
      ) : posted.length === 0 ? (
        <div className="glass-card rounded-2xl p-8">
          <PremiumEmptyState
            variant="compact"
            icon="menu_book"
            title="Книга пока пуста"
            description="Добавьте доходы и расходы в журнале и подтвердите их кнопкой «Провести» — записи появятся в разделах I и II."
            actions={
              <Link to="/accounting/journal" className="btn-primary min-h-11 px-5 text-sm">
                Открыть журнал
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="glass-card mb-4 overflow-hidden rounded-2xl">
            <div className="border-b border-outline/20 px-4 py-3 sm:px-6">
              <h2 className="font-headline text-base font-bold text-on-surface">Раздел I. Доходы</h2>
              <p className="text-xs text-on-surface-variant">{incomeRows.length} записей</p>
            </div>
            <KudirTable rows={incomeRows} section="income" startIndex={0} />
          </div>

          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="border-b border-outline/20 px-4 py-3 sm:px-6">
              <h2 className="font-headline text-base font-bold text-on-surface">Раздел II. Расходы</h2>
              <p className="text-xs text-on-surface-variant">{expenseRows.length} записей</p>
            </div>
            <KudirTable rows={expenseRows} section="expense" startIndex={incomeRows.length} />
          </div>
        </>
      )}
    </div>
  )
}
