import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categorizationRulesApi, counterpartiesApi, dashboardApi, onecApi } from '../api/client'
import AppModal from '../components/ui/AppModal'
import { Link } from 'react-router-dom'

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
type PipelineStatus = 'new' | 'parsed' | 'categorized' | 'verified' | 'reported'

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
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [editingTx, setEditingTx] = useState<any | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [ruleForm, setRuleForm] = useState({
    name: '',
    category: 'services',
    transaction_type: 'expense',
    counterparty_id: '',
    description_pattern: '',
    min_amount: '',
    max_amount: '',
    vat_required: 'any',
    priority: '100',
  })

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

  const { data: syncJobsData } = useQuery({
    queryKey: ['onec-sync-jobs'],
    queryFn: () => onecApi.listSyncJobs().then((r) => r.data),
    refetchInterval: 5000,
  })
  const { data: rulesData } = useQuery({
    queryKey: ['categorization-rules'],
    queryFn: () => categorizationRulesApi.list().then((r) => r.data as any[]),
  })
  const { data: counterpartiesData } = useQuery({
    queryKey: ['counterparties', 'for-rules'],
    queryFn: () => counterpartiesApi.list().then((r) => r.data as any[]),
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

  const syncMutation = useMutation({
    mutationFn: (transactionId: string) => onecApi.syncTransaction({ transaction_id: transactionId, max_attempts: 3 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onec-sync-jobs'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const retrySyncMutation = useMutation({
    mutationFn: (jobId: string) => onecApi.retrySyncJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onec-sync-jobs'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
  const createRuleMutation = useMutation({
    mutationFn: () =>
      categorizationRulesApi.create({
        name: ruleForm.name.trim(),
        category: ruleForm.category,
        transaction_type: ruleForm.transaction_type || null,
        counterparty_id: ruleForm.counterparty_id || null,
        description_pattern: ruleForm.description_pattern.trim() || null,
        min_amount: ruleForm.min_amount ? Number(ruleForm.min_amount) : null,
        max_amount: ruleForm.max_amount ? Number(ruleForm.max_amount) : null,
        vat_required: ruleForm.vat_required === 'any' ? null : ruleForm.vat_required === 'yes',
        priority: Number(ruleForm.priority || 100),
        is_active: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorization-rules'] })
      setRuleForm({
        name: '',
        category: 'services',
        transaction_type: 'expense',
        counterparty_id: '',
        description_pattern: '',
        min_amount: '',
        max_amount: '',
        vat_required: 'any',
        priority: '100',
      })
    },
  })
  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => categorizationRulesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorization-rules'] }),
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
  const syncJobs = syncJobsData?.jobs ?? []
  const syncJobByTx = new Map<string, any>()
  for (const job of syncJobs) {
    if (!job?.transaction_id) continue
    const prev = syncJobByTx.get(job.transaction_id)
    if (!prev) {
      syncJobByTx.set(job.transaction_id, job)
      continue
    }
    const prevTs = Date.parse(prev.created_at || '') || 0
    const curTs = Date.parse(job.created_at || '') || 0
    if (curTs > prevTs) syncJobByTx.set(job.transaction_id, job)
  }
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const isSaving = addMutation.isPending || editMutation.isPending

  function getSyncBadge(tx: any) {
    const job = syncJobByTx.get(tx.id)
    if (job?.status === 'running') return 'Синк: в работе'
    if (job?.status === 'retry') return 'Синк: повтор'
    if (job?.status === 'failed') return 'Синк: ошибка'
    if (job?.status === 'success' || tx.status === 'synced') return 'Синк: выполнен'
    if (job?.status === 'pending') return 'Синк: в очереди'
    if (tx.status === 'confirmed') return 'Подтв.'
    return 'Черновик'
  }

  function pipelineLabel(status?: PipelineStatus) {
    if (status === 'parsed') return 'parsed'
    if (status === 'categorized') return 'categorized'
    if (status === 'verified') return 'verified'
    if (status === 'reported') return 'reported'
    return 'new'
  }

  function pipelineBadgeClass(status?: PipelineStatus) {
    if (status === 'reported') return 'bg-secondary/10 text-secondary border border-secondary/20'
    if (status === 'verified') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    if (status === 'categorized') return 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
    if (status === 'parsed') return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    return 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
  }

  function getSyncBadgeClass(tx: any) {
    const job = syncJobByTx.get(tx.id)
    if (job?.status === 'failed') return 'bg-error/10 text-error border border-error/20'
    if (job?.status === 'running' || job?.status === 'retry' || job?.status === 'pending') {
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    }
    if (job?.status === 'success' || tx.status === 'synced') {
      return 'bg-secondary/10 text-secondary border border-secondary/20'
    }
    return 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
  }

  return (
    <div className="max-w-7xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="card-elevated flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="page-heading">Операции</h1>
          <p className="mt-1 text-sm text-zinc-500">{total} операций · единый журнал доходов/расходов</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">new</span>
            <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">parsed</span>
            <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">categorized</span>
            <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">verified</span>
            <span className="rounded-full border border-outline/80 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">reported</span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setShowRulesModal(true)}>
            <Icon name="auto_fix_high" className="text-lg" /> Правила
          </button>
          <Link to="/documents" className="btn-secondary w-full sm:w-auto">
            <Icon name="upload_file" className="text-lg" /> Импорт
          </Link>
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={openCreate}>
            <Icon name="add" className="text-lg" /> Добавить
          </button>
        </div>
      </div>

      {/* Filter tabs — горизонтальный скролл на телефоне */}
      <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 border border-zinc-200/80 shadow-soft sm:inline-flex sm:min-w-0">
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
      <div className="page-section grid grid-cols-1 gap-3 p-4 sm:gap-4 sm:p-5 md:grid-cols-3">
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
      <div className="overflow-hidden rounded-2xl bg-surface-container-low border border-zinc-200/80 shadow-soft">
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
                        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 ${meta.color}`}
                      >
                        <Icon name={meta.icon} filled className="text-xl" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-headline text-sm font-semibold text-on-surface">{tx.description || meta.label}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{tx.transaction_date}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase rounded-md px-2 py-0.5 ${getSyncBadgeClass(tx)}`}>
                            {getSyncBadge(tx)}
                          </span>
                          <span className={`text-[9px] font-bold uppercase rounded-md px-2 py-0.5 ${pipelineBadgeClass(tx.pipeline_status)}`}>
                            {pipelineLabel(tx.pipeline_status)}
                          </span>
                          {tx.category && (
                            <span className="text-[10px] text-zinc-500">{tx.category}</span>
                          )}
                          {Array.isArray(tx.validation_issues) && tx.validation_issues.length > 0 && (
                            <span className="text-[10px] text-amber-400">{tx.validation_issues[0]}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-2">
                        <p
                          className={`font-headline text-sm font-extrabold ${
                            tx.type === 'income' ? 'text-emerald-700' : 'text-on-surface'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '−'}
                          {fmt(tx.amount)}
                        </p>
                        <span className="text-[10px] text-zinc-500">BYN</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-50 text-zinc-600"
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
                          {syncJobByTx.get(tx.id)?.status === 'failed' ? (
                            <button
                              type="button"
                              className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-800"
                              disabled={retrySyncMutation.isPending}
                              onClick={() => retrySyncMutation.mutate(syncJobByTx.get(tx.id).id)}
                              aria-label="Повторить синк"
                            >
                              <Icon name="refresh" className="text-lg" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary"
                              disabled={syncMutation.isPending || (Array.isArray(tx.validation_issues) && tx.validation_issues.length > 0)}
                              onClick={() => syncMutation.mutate(tx.id)}
                              aria-label="Синхронизировать"
                            >
                              <Icon name="sync" className="text-lg" />
                            </button>
                          )}
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
                  <tr className="table-head-row">
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
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${getSyncBadgeClass(tx)}`}>
                              {getSyncBadge(tx)}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${pipelineBadgeClass(tx.pipeline_status)}`}>
                              {pipelineLabel(tx.pipeline_status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4">
                          <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            {syncJobByTx.get(tx.id)?.status === 'failed' ? (
                              <button
                                type="button"
                                className="btn-ghost !px-2 !py-1 !text-xs text-amber-800 hover:text-amber-950"
                                disabled={retrySyncMutation.isPending}
                                onClick={() => retrySyncMutation.mutate(syncJobByTx.get(tx.id).id)}
                                title="Повторить синк"
                              >
                                <Icon name="refresh" className="text-sm" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-ghost !px-2 !py-1 !text-xs text-secondary hover:text-secondary"
                                disabled={syncMutation.isPending || (Array.isArray(tx.validation_issues) && tx.validation_issues.length > 0)}
                                onClick={() => syncMutation.mutate(tx.id)}
                                title="Синхронизировать"
                              >
                                <Icon name="sync" className="text-sm" />
                              </button>
                            )}
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
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
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
                        : 'border-zinc-200/90 text-zinc-600 hover:border-primary/25 hover:bg-primary/5'
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
                className="input min-h-11 rounded-xl"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            {form.type === 'expense' && (
              <div>
                <label className="label">Категория</label>
                <select
                  className="input min-h-11 rounded-xl"
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
                className="input min-h-11 rounded-xl"
                placeholder="Оплата по договору №..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                className="input min-h-11 rounded-xl"
                value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              />
            </div>
          </div>
        </AppModal>
      )}
      {showRulesModal && (
        <AppModal
          title="Правила автокатегоризации"
          wide
          onClose={() => setShowRulesModal(false)}
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <button type="button" className="btn-secondary min-h-12 w-full" onClick={() => setShowRulesModal(false)}>
                Закрыть
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className="input" placeholder="Название правила" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
              <select className="input" value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}>
                {CATEGORIES.filter((c) => c.value).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select className="input" value={ruleForm.transaction_type} onChange={(e) => setRuleForm({ ...ruleForm, transaction_type: e.target.value })}>
                <option value="">Любой тип</option>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
                <option value="refund">Возврат</option>
                <option value="writeoff">Списание</option>
              </select>
              <select className="input" value={ruleForm.counterparty_id} onChange={(e) => setRuleForm({ ...ruleForm, counterparty_id: e.target.value })}>
                <option value="">Любой контрагент</option>
                {(Array.isArray(counterpartiesData) ? counterpartiesData : []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input className="input sm:col-span-2" placeholder="Фрагмент назначения платежа" value={ruleForm.description_pattern} onChange={(e) => setRuleForm({ ...ruleForm, description_pattern: e.target.value })} />
              <input type="number" min="0" step="0.01" className="input" placeholder="Сумма от" value={ruleForm.min_amount} onChange={(e) => setRuleForm({ ...ruleForm, min_amount: e.target.value })} />
              <input type="number" min="0" step="0.01" className="input" placeholder="Сумма до" value={ruleForm.max_amount} onChange={(e) => setRuleForm({ ...ruleForm, max_amount: e.target.value })} />
              <select className="input" value={ruleForm.vat_required} onChange={(e) => setRuleForm({ ...ruleForm, vat_required: e.target.value })}>
                <option value="any">НДС: не важно</option>
                <option value="yes">Только с НДС</option>
                <option value="no">Только без НДС</option>
              </select>
              <input type="number" min="1" max="1000" className="input" placeholder="Приоритет (меньше = выше)" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })} />
            </div>
            <button
              type="button"
              className="btn-primary min-h-11 w-full"
              disabled={!ruleForm.name.trim() || createRuleMutation.isPending}
              onClick={() => createRuleMutation.mutate()}
            >
              {createRuleMutation.isPending ? 'Сохраняем...' : 'Добавить правило'}
            </button>
            <div className="space-y-2">
              {(rulesData ?? []).length === 0 ? (
                <p className="text-xs text-zinc-500">Правил пока нет. Будут применяться базовые автоэвристики.</p>
              ) : (
                (rulesData ?? []).map((rule: any) => (
                  <div key={rule.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-on-surface">{rule.name}</p>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 !text-xs text-error hover:text-error"
                        disabled={deleteRuleMutation.isPending}
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                      >
                        Удалить
                      </button>
                    </div>
                    <p className="mt-1 text-on-surface-variant">
                      Категория: {rule.category} · приоритет: {rule.priority}
                      {rule.description_pattern ? ` · текст: "${rule.description_pattern}"` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}
