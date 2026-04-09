import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '../api/client'
import AppModal from '../components/ui/AppModal'

function fmt(n: any) {
  return Number(n || 0).toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

const PER_PAGE = 20
type TxType = 'income' | 'expense' | 'refund' | 'writeoff'

const TX_META: Record<TxType, { label: string; icon: string; color: string; badge: string }> = {
  income:   { label: 'Доход',    icon: 'arrow_downward', color: 'text-secondary',       badge: 'bg-secondary/10 text-secondary border border-secondary/20' },
  expense:  { label: 'Расход',   icon: 'arrow_upward',   color: 'text-error',            badge: 'bg-error/10 text-error border border-error/20' },
  refund:   { label: 'Возврат',  icon: 'replay',         color: 'text-tertiary',          badge: 'bg-tertiary/10 text-tertiary border border-tertiary/20' },
  writeoff: { label: 'Списание', icon: 'delete_sweep',   color: 'text-on-surface-variant', badge: 'bg-surface-variant text-on-surface-variant border border-outline-variant/20' },
}

const CATEGORIES = [
  { value: '', label: '— Без категории —' },
  { value: 'salary', label: 'Зарплата' },
  { value: 'rent', label: 'Аренда' },
  { value: 'materials', label: 'Материалы' },
  { value: 'marketing', label: 'Маркетинг' },
  { value: 'taxes', label: 'Налоги' },
  { value: 'utilities', label: 'Коммунальные' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'office', label: 'Офис' },
  { value: 'services', label: 'Услуги' },
  { value: 'other', label: 'Прочее' },
]

const emptyForm = {
  type: 'income' as TxType,
  amount: '',
  category: '',
  description: '',
  transaction_date: new Date().toISOString().split('T')[0],
}

export default function TransactionsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<any | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filter, page, search, dateFrom, dateTo],
    queryFn: () =>
      dashboardApi
        .getTransactions({
          type: filter === 'all' ? undefined : filter,
          per_page: PER_PAGE,
          page,
          search: search || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
        .then((r) => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const addMutation = useMutation({
    mutationFn: () =>
      dashboardApi.createTransaction({
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category || undefined,
        description: form.description || undefined,
        transaction_date: form.transaction_date,
      }),
    onSuccess: () => { invalidate(); closeModal() },
  })

  const editMutation = useMutation({
    mutationFn: () =>
      dashboardApi.updateTransaction(editingTx.id, {
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category || undefined,
        description: form.description || undefined,
        transaction_date: form.transaction_date,
      }),
    onSuccess: () => { invalidate(); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardApi.deleteTransaction(id),
    onSuccess: invalidate,
  })

  function openCreate() { setEditingTx(null); setForm({ ...emptyForm }); setShowModal(true) }

  function openEdit(tx: any) {
    setEditingTx(tx)
    setForm({ type: tx.type, amount: String(tx.amount), category: tx.category || '', description: tx.description || '', transaction_date: tx.transaction_date })
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditingTx(null); setForm({ ...emptyForm }) }

  function handleSave() { editingTx ? editMutation.mutate() : addMutation.mutate() }

  const transactions = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const isSaving = addMutation.isPending || editMutation.isPending

  return (
    <div className="max-w-7xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Операции</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{total} операций</p>
        </div>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={openCreate}>
          <Icon name="add" className="text-lg" /> Добавить
        </button>
      </div>

      {/* Filter tabs — горизонтальный скролл на телефоне */}
      <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 ring-1 ring-white/[0.05] sm:inline-flex sm:min-w-0">
          {[
            { key: 'all', label: 'Все' },
            { key: 'income', label: 'Доходы' },
            { key: 'expense', label: 'Расходы' },
            { key: 'refund', label: 'Возвраты' },
            { key: 'writeoff', label: 'Списания' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setFilter(tab.key)
                setPage(1)
              }}
              className={`tap-highlight-none whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:py-1.5 ${
                filter === tab.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-surface-container-low p-4 ring-1 ring-white/[0.05] sm:gap-4 sm:p-5 md:grid-cols-3">
        <div>
          <label className="label">Поиск</label>
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
            <input className="input pl-10" placeholder="По описанию..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        <div>
          <label className="label">С даты</label>
          <input type="date" className="input" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
        </div>
        <div>
          <label className="label">По дату</label>
          <input type="date" className="input" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
        </div>
      </div>

      {/* Список: карточки на мобиле, таблица с md */}
      <div className="overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-white/[0.05]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-zinc-500">
            <Icon name="hourglass_empty" className="animate-spin" /> Загружаем...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center sm:p-16">
            <Icon name="receipt_long" className="text-5xl text-on-surface-variant/20" />
            <p className="mt-4 text-sm text-zinc-500">Операций нет</p>
            <button type="button" className="btn-primary mt-4" onClick={openCreate}>
              <Icon name="add" className="text-lg" /> Добавить первую
            </button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {transactions.map((tx: any) => {
                const meta = TX_META[tx.type as TxType] || TX_META.expense
                return (
                  <li key={tx.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ${meta.color}`}
                      >
                        <Icon name={meta.icon} filled className="text-xl" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-headline text-sm font-semibold text-white">{tx.description || meta.label}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{tx.transaction_date}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[9px] font-bold uppercase ${meta.badge} rounded-md px-2 py-0.5`}
                          >
                            {tx.status === 'synced' ? '1С' : tx.status === 'confirmed' ? 'Подтв.' : 'Черновик'}
                          </span>
                          {tx.category && (
                            <span className="text-[10px] text-zinc-500">{tx.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-2">
                        <p
                          className={`font-headline text-sm font-extrabold ${
                            tx.type === 'income' ? 'text-emerald-300' : 'text-white'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '−'}
                          {fmt(tx.amount)}
                        </p>
                        <span className="text-[10px] text-zinc-500">BYN</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300"
                            onClick={() => openEdit(tx)}
                            aria-label="Изменить"
                          >
                            <Icon name="edit" className="text-lg" />
                          </button>
                          <button
                            type="button"
                            className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-300"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm('Удалить операцию?')) deleteMutation.mutate(tx.id)
                            }}
                            aria-label="Удалить"
                          >
                            <Icon name="delete" className="text-lg" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="bg-surface-container-high/50 text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Описание</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Дата</th>
                    <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Сумма</th>
                    <th className="px-4 py-3 text-center sm:px-6 sm:py-4">Статус</th>
                    <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {transactions.map((tx: any) => {
                    const meta = TX_META[tx.type as TxType] || TX_META.expense
                    return (
                      <tr key={tx.id} className="group transition-colors hover:bg-surface-container-high">
                        <td className="px-4 py-3 sm:px-6 sm:py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest ${meta.color}`}
                            >
                              <Icon name={meta.icon} filled className="text-lg" />
                            </div>
                            <span className="text-sm font-medium text-on-surface">{tx.description || meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant sm:px-6 sm:py-4">{tx.transaction_date}</td>
                        <td
                          className={`px-4 py-3 text-right font-headline text-sm font-extrabold sm:px-6 sm:py-4 ${
                            tx.type === 'income' ? 'text-secondary' : 'text-on-surface'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '−'}
                          {fmt(tx.amount)} BYN
                        </td>
                        <td className="px-4 py-3 text-center sm:px-6 sm:py-4">
                          <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${meta.badge}`}>
                            {tx.status === 'synced' ? '1С' : tx.status === 'confirmed' ? 'Подтв.' : 'Черновик'}
                          </span>
                        </td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4">
                          <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <button type="button" className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => openEdit(tx)}>
                              <Icon name="edit" className="text-sm" />
                            </button>
                            <button
                              type="button"
                              className="btn-ghost !px-2 !py-1 !text-xs text-error hover:text-error"
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                if (confirm('Удалить операцию?')) deleteMutation.mutate(tx.id)
                              }}
                            >
                              <Icon name="delete" className="text-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            className="btn-ghost tap-highlight-none"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <Icon name="chevron_left" className="text-lg" /> Назад
          </button>
          <span className="px-2 text-sm font-medium text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-ghost tap-highlight-none"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд <Icon name="chevron_right" className="text-lg" />
          </button>
        </div>
      )}

      {showModal && (
        <AppModal
          title={editingTx ? 'Редактировать операцию' : 'Новая операция'}
          onClose={closeModal}
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-h-12 flex-1 sm:min-h-0" onClick={closeModal}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary min-h-12 flex-1 sm:min-h-0"
                disabled={!form.amount || isSaving}
                onClick={handleSave}
              >
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              {(Object.keys(TX_META) as TxType[]).map((t) => {
                const m = TX_META[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`tap-highlight-none flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition-all sm:py-2.5 sm:text-sm ${
                      form.type === t
                        ? m.badge
                        : 'border-white/[0.08] text-zinc-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon name={m.icon} className="text-lg" /> {m.label}
                  </button>
                )
              })}
            </div>
            <div>
              <label className="label">Сумма (BYN)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                className="input min-h-11 rounded-xl bg-white/[0.06] ring-1 ring-white/[0.06]"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            {form.type === 'expense' && (
              <div>
                <label className="label">Категория</label>
                <select
                  className="input min-h-11 rounded-xl bg-white/[0.06] ring-1 ring-white/[0.06]"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Описание</label>
              <input
                className="input min-h-11 rounded-xl bg-white/[0.06] ring-1 ring-white/[0.06]"
                placeholder="Оплата по договору №..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                className="input min-h-11 rounded-xl bg-white/[0.06] ring-1 ring-white/[0.06]"
                value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              />
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}
