import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { dashboardApi, documentsApi, scannerApi } from '../api/client'
import { DataTableShell, useDataTableSelection } from '../components/datatable'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import { WorkflowSidePanel, WorkflowCompletionBanner } from '../components/workflow'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  rent: ['аренда', 'офис', 'помещение'],
  tax: ['налог', 'фсзн', 'ндс'],
  advertising: ['реклама', 'ads', 'маркетинг'],
  goods: ['товар', 'закупка', 'склад'],
}

const CAT_LABELS: Record<string, string> = {
  rent: 'Аренда',
  tax: 'Налоги',
  advertising: 'Реклама',
  goods: 'Товары',
  other: 'Прочее',
}

export function suggestCategory(text: string) {
  const value = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((word) => value.includes(word))) return { category, confidence: 0.82 }
  }
  return { category: 'other', confidence: 0.51 }
}

function fmt(n: number) {
  return n.toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

function findDuplicateTx(target: any, items: any[]) {
  return items.filter(
    (o) =>
      o.id !== target.id &&
      Math.abs(Number(o.amount || 0) - Number(target.amount || 0)) < 0.01 &&
      String(o.transaction_date || '') === String(target.transaction_date || ''),
  )
}

function TransactionSideContent({
  tx,
  allItems,
  onClose,
}: {
  tx: any
  allItems: any[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const suggestion = useMemo(() => suggestCategory(String(tx.description || '')), [tx.description])
  const [category, setCategory] = useState(tx.category || 'other')
  const [description, setDescription] = useState(tx.description || '')
  const [amount, setAmount] = useState(String(tx.amount ?? ''))
  const duplicates = useMemo(() => findDuplicateTx(tx, allItems), [tx, allItems])

  useEffect(() => {
    setCategory(tx.category || 'other')
    setDescription(tx.description || '')
    setAmount(String(tx.amount ?? ''))
  }, [tx.id, tx.category, tx.description, tx.amount])

  const updateMutation = useMutation({
    mutationFn: () =>
      dashboardApi.updateTransaction(tx.id, {
        type: tx.type,
        amount: parseFloat(amount || '0'),
        category: category || undefined,
        description: description || undefined,
        transaction_date: tx.transaction_date,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      onClose()
    },
  })

  const aiDiffers = suggestion.category !== (tx.category || 'other')

  return (
    <div className="space-y-5">
      {duplicates.length > 0 && (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-bold uppercase tracking-wider text-amber-200/90">Возможный дубликат</p>
          <p className="mt-1 text-on-surface-variant">
            Ещё {duplicates.length} операций с той же суммой и датой — проверьте, что это не повтор проводки.
          </p>
        </div>
      )}

      <div>
        <label className="label">Статус</label>
        <span className="mt-1 inline-flex rounded-lg border border-outline/50 px-2 py-1 text-xs font-bold uppercase text-on-surface-variant">
          {tx.status === 'draft' ? 'Черновик' : 'Проведён'} · {tx.source || 'manual'}
        </span>
      </div>

      <div>
        <label className="label">ИИ · категория</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {CAT_LABELS[suggestion.category] || suggestion.category}{' '}
            <span className="text-on-surface-variant">({Math.round(suggestion.confidence * 100)}%)</span>
          </span>
          {aiDiffers && (
            <button
              type="button"
              className="btn-secondary min-h-9 px-3 py-1 text-xs font-bold"
              onClick={() => setCategory(suggestion.category)}
            >
              Применить
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label">Категория</label>
        <select className="input mt-1 min-h-11 w-full rounded-xl" value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CAT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Сумма (BYN)</label>
        <input className="input mt-1 min-h-11 w-full rounded-xl" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </div>

      <div>
        <label className="label">Описание</label>
        <textarea className="input mt-1 min-h-[88px] w-full rounded-xl text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-outline/40 pt-4">
        <Link to="/scan" className="btn-secondary min-h-10 flex-1 px-3 text-center text-xs font-bold sm:flex-none">
          <Icon name="document_scanner" className="text-lg" /> OCR
        </Link>
        <Link to="/bank" className="btn-secondary min-h-10 flex-1 px-3 text-center text-xs font-bold sm:flex-none">
          <Icon name="account_balance" className="text-lg" /> Банк
        </Link>
        <Link to="/counterparties" className="btn-ghost min-h-10 px-2 text-xs">
          Контрагенты
        </Link>
      </div>

      <button
        type="button"
        className="btn-primary min-h-12 w-full"
        disabled={updateMutation.isPending}
        onClick={() => updateMutation.mutate()}
      >
        {updateMutation.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
      </button>
    </div>
  )
}

export default function Accounting() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const monthStartStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)

  const [workspaceFocus, setWorkspaceFocus] = useState<'ledger' | 'capture'>('ledger')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('other')
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [source, setSource] = useState<'manual' | 'scan' | 'bank'>('manual')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(monthStartStr)
  const [filterDateTo, setFilterDateTo] = useState(todayStr)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [linkedCounterpartyId, setLinkedCounterpartyId] = useState<string | null>(null)
  const [panelTx, setPanelTx] = useState<any | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const aiSuggestion = useMemo(() => suggestCategory(description), [description])

  useEffect(() => {
    const cid = searchParams.get('counterparty_id')
    const cname = searchParams.get('counterparty_name')
    const preset = searchParams.get('preset')
    if (!cid && !cname && !preset) return

    if (preset === 'income' || preset === 'expense') setType(preset)
    if (cid) setLinkedCounterpartyId(cid)
    if (cname && cname.trim()) {
      setDescription((d) => d || `Операция с контрагентом: ${decodeURIComponent(cname)}`)
    }
    const next = new URLSearchParams(searchParams)
    let changed = false
    ;['counterparty_id', 'counterparty_name', 'preset'].forEach((k) => {
      if (next.has(k)) {
        next.delete(k)
        changed = true
      }
    })
    if (changed) setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const txQuery = useQuery({
    queryKey: ['transactions', 'accounting'],
    queryFn: () => dashboardApi.getTransactions({ per_page: 500 }).then((r) => r.data),
  })

  const filteredItems = useMemo(() => {
    const items = txQuery.data?.items || []
    return items.filter((tx: any) => {
      const txDate = String(tx.transaction_date || '')
      if (filterDateFrom && txDate < filterDateFrom) return false
      if (filterDateTo && txDate > filterDateTo) return false
      if (filterType !== 'all' && tx.type !== filterType) return false
      if (filterSearch.trim()) {
        const term = filterSearch.trim().toLowerCase()
        const hay = `${tx.description || ''} ${tx.category || ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [txQuery.data?.items, filterDateFrom, filterDateTo, filterType, filterSearch])

  const visibleIds = useMemo(() => filteredItems.map((t: any) => String(t.id)), [filteredItems])
  const selection = useDataTableSelection(visibleIds)

  const stats = useMemo(() => {
    let income = 0
    let expense = 0
    let drafts = 0
    for (const tx of filteredItems as any[]) {
      const a = Number(tx.amount || 0)
      if (tx.type === 'income') income += a
      else expense += a
      if (tx.status === 'draft') drafts += 1
    }
    return { income, expense, net: income - expense, drafts, count: filteredItems.length }
  }, [filteredItems])

  const uploadScanMutation = useMutation({
    mutationFn: async () => {
      if (!scanFile) return null
      const response = await scannerApi.upload(scanFile)
      const parsed = response.data?.parsed || {}
      setDescription((d) => d || parsed?.description || '')
      setAmount((a) => a || String(parsed?.amount || ''))
      setTransactionDate((v) => (parsed?.date ? String(parsed.date).slice(0, 10) : v))
      setSource('scan')
      setWorkspaceFocus('capture')
      return response.data
    },
  })

  const uploadToKudirMutation = useMutation({
    mutationFn: async () => {
      if (!scanFile) return null
      return scannerApi.uploadToKudir(scanFile)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      dashboardApi.createTransaction({
        type,
        amount: Number(amount || 0),
        vat_amount: 0,
        category,
        description,
        source,
        ai_category_confidence: aiSuggestion.confidence,
        receipt_image_url: receiptUrl || null,
        transaction_date: transactionDate,
        counterparty_id: linkedCounterpartyId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setAmount('')
      setDescription('')
      setReceiptUrl('')
      setSource('manual')
      setLinkedCounterpartyId(null)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 4200)
      setWorkspaceFocus('ledger')
    },
  })

  async function downloadKudir() {
    const from = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
    const to = new Date().toISOString().slice(0, 10)
    const { data } = await documentsApi.transactionsCsv(from, to)
    const url = URL.createObjectURL(new Blob([data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'kudir.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!amount || !description) return
    createMutation.mutate()
  }

  const isLoading = txQuery.isLoading

  return (
    <section className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-8">
      <div className="card-elevated relative overflow-hidden rounded-3xl p-6 shadow-lift ring-1 ring-primary/[0.06]">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#004d40] via-emerald-500 to-cyan-400/90" aria-hidden />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600/90 dark:text-emerald-400/85">Операционный контур</p>
            <h1 className="page-heading mt-1 text-[1.65rem] sm:text-3xl">Учёт · рабочее место</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Журнал, OCR и классификация в одном потоке — откройте строку справа, не уходя со страницы.
            </p>
            {linkedCounterpartyId ? (
              <p className="mt-2 text-xs font-medium text-primary">
                Следующая проводка привязана к контрагенту из справочника.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary shrink-0 rounded-[1rem]" onClick={downloadKudir}>
              Скачать КУДиР
            </button>
            <Link to="/scan" className="btn-secondary shrink-0 rounded-[1rem]">
              <Icon name="document_scanner" className="text-lg" /> Сканер
            </Link>
            <Link to="/bank" className="btn-secondary shrink-0 rounded-[1rem]">
              <Icon name="sync_alt" className="text-lg" /> Банк
            </Link>
          </div>
        </div>

        <div className="mt-6 flex gap-1 rounded-full border border-outline/60 bg-surface-container-low/80 p-1">
          {(
            [
              { id: 'ledger' as const, label: 'Журнал', icon: 'receipt_long' },
              { id: 'capture' as const, label: 'Ввод и OCR', icon: 'edit_note' },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setWorkspaceFocus(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition sm:flex-none sm:px-5 ${
                workspaceFocus === t.id
                  ? 'bg-gradient-to-r from-emerald-600 to-primary text-on-primary shadow-glow'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={t.icon} className="text-lg" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Записей в фильтре', value: String(stats.count), accent: 'text-on-surface' },
            { label: 'Доходы', value: `${fmt(stats.income)} BYN`, accent: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Расходы', value: `${fmt(stats.expense)} BYN`, accent: 'text-on-surface' },
            { label: 'Черновики', value: String(stats.drafts), accent: stats.drafts ? 'text-amber-400' : 'text-on-surface-variant' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-3 dark:bg-black/20">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">{s.label}</p>
              <p className={`mt-1 font-headline text-sm font-bold tabular-nums sm:text-base ${s.accent}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          {savedFlash && (
            <WorkflowCompletionBanner key="ok" message="Операция добавлена в журнал и учтена в потоке." />
          )}
        </AnimatePresence>
      </div>

      {workspaceFocus === 'capture' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
          id="accounting-capture"
        >
          <form
            className="card-elevated grid gap-4 rounded-3xl p-6 shadow-card ring-1 ring-primary/[0.05] md:grid-cols-2"
            onSubmit={submit}
          >
            <select className="input min-h-11 rounded-xl" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <input className="input min-h-11 rounded-xl" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
            <input className="input min-h-11 rounded-xl" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <select className="input min-h-11 rounded-xl" value={source} onChange={(e) => setSource(e.target.value as 'manual' | 'scan' | 'bank')}>
              <option value="manual">Ручной ввод</option>
              <option value="scan">Скан / OCR</option>
              <option value="bank">Банк</option>
            </select>
            <textarea
              className="input md:col-span-2 min-h-[90px] rounded-xl"
              placeholder="Описание / назначение"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
              <select className="input min-h-11 rounded-xl" value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CAT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="input min-h-11 rounded-xl"
                placeholder="URL чека"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
              />
              <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-on-surface">
                <span className="font-semibold text-primary">ИИ:</span> {CAT_LABELS[aiSuggestion.category]}{' '}
                <span className="text-on-surface-variant">({Math.round(aiSuggestion.confidence * 100)}%)</span>
                {aiSuggestion.category !== category && (
                  <button
                    type="button"
                    className="ml-2 text-xs font-bold text-primary underline"
                    onClick={() => setCategory(aiSuggestion.category)}
                  >
                    применить
                  </button>
                )}
              </div>
            </div>
            <div className="md:col-span-2 rounded-3xl border-2 border-dashed border-emerald-400/35 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-cyan-500/[0.05] p-5 shadow-inner backdrop-blur-sm dark:border-emerald-400/25">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Icon name="document_scanner" className="text-xl" />
                </span>
                <div>
                  <p className="font-headline text-sm font-bold text-on-surface">OCR · загрузка скана</p>
                  <p className="text-xs text-on-surface-variant">Извлечение полей и подстановка в форму.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <input type="file" className="input border-dashed bg-surface/80" onChange={(e) => setScanFile(e.target.files?.[0] || null)} />
                <button
                  type="button"
                  className="btn-secondary whitespace-nowrap"
                  onClick={() => uploadScanMutation.mutate()}
                  disabled={!scanFile || uploadScanMutation.isPending}
                >
                  OCR из скана
                </button>
                <button
                  type="button"
                  className="btn-secondary whitespace-nowrap"
                  onClick={() => uploadToKudirMutation.mutate()}
                  disabled={!scanFile || uploadToKudirMutation.isPending}
                >
                  В КУДиР
                </button>
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary min-h-12 px-8" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Добавляем…' : 'Добавить в журнал'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className={workspaceFocus === 'capture' ? 'mt-8' : 'mt-6'}>
        <DataTableShell
          toolbar={
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between xl:gap-4">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input className="input min-h-11 rounded-xl" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                <input className="input min-h-11 rounded-xl" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                <select className="input min-h-11 rounded-xl" value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'expense')}>
                  <option value="all">Все типы</option>
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                </select>
                <input
                  className="input min-h-11 rounded-xl"
                  placeholder="Поиск по описанию"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost min-h-10 px-3 text-xs"
                  onClick={() => {
                    setFilterDateFrom(monthStartStr)
                    setFilterDateTo(todayStr)
                  }}
                >
                  Этот месяц
                </button>
                <button type="button" className="btn-ghost min-h-10 px-3 text-xs" onClick={() => selection.clear()}>
                  Снять выбор
                </button>
              </div>
            </div>
          }
          bulkBar={
            <>
              <span className="text-xs font-semibold text-emerald-100">Выбрано: {selection.selectedCount}</span>
              <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => selection.clear()}>
                Очистить
              </button>
              <Link to="/bank" className="btn-secondary min-h-9 px-4 text-xs font-bold">
                Сверка в банке
              </Link>
            </>
          }
          selectedCount={selection.selectedCount}
        >
          {isLoading ? (
            <TableSkeleton rows={10} cols={5} />
          ) : filteredItems.length === 0 ? (
            <div className="p-6">
              <PremiumEmptyState
                icon="receipt_long"
                title="Нет записей по фильтрам"
                description="Смените период или добавьте операцию сверху."
                actions={
                  <button type="button" className="btn-primary mt-4 min-h-11 px-4" onClick={() => setWorkspaceFocus('capture')}>
                    Добавить операцию
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-outline-variant/10 md:hidden">
                {(filteredItems as any[]).map((tx: any) => (
                    <li key={tx.id} className="p-4">
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-outline-variant"
                          checked={selection.isSelected(String(tx.id))}
                          onChange={() => selection.toggle(String(tx.id))}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Выбрать"
                        />
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPanelTx(tx)}>
                          <p className="font-semibold text-on-surface">{tx.description || '—'}</p>
                          <p className="text-xs text-on-surface-variant">
                            {tx.transaction_date} · {CAT_LABELS[tx.category] || tx.category || 'Прочее'}
                          </p>
                        </button>
                        <span className="shrink-0 font-headline font-bold tabular-nums">{fmt(Number(tx.amount))}</span>
                      </div>
                    </li>
                ))}
              </ul>

              <div className="fc-premium-table hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-outline-variant"
                          checked={selection.allVisibleSelected}
                          onChange={() => selection.toggleAllVisible()}
                          aria-label="Выбрать все"
                        />
                      </th>
                      <th className="px-4 py-3">Дата</th>
                      <th className="px-4 py-3">Описание</th>
                      <th className="px-4 py-3">Категория</th>
                      <th className="px-4 py-3 text-right">Сумма</th>
                      <th className="w-28 px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {(filteredItems as any[]).map((tx: any) => (
                        <tr key={tx.id} className="cursor-pointer transition-colors hover:bg-emerald-500/[0.04]" onClick={() => setPanelTx(tx)}>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-outline-variant"
                              checked={selection.isSelected(String(tx.id))}
                              onChange={() => selection.toggle(String(tx.id))}
                              aria-label="Выбрать"
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">{tx.transaction_date}</td>
                          <td className="max-w-[240px] px-4 py-3">
                            <p className="truncate font-medium text-on-surface">{tx.description || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs">{CAT_LABELS[tx.category] || tx.category || 'Прочее'}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-headline font-bold tabular-nums text-on-surface">{fmt(Number(tx.amount))}</td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="btn-ghost min-h-9 px-2 text-xs font-bold text-primary" onClick={() => setPanelTx(tx)}>
                              Обзор
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DataTableShell>
      </div>

      <WorkflowSidePanel
        open={!!panelTx}
        onClose={() => setPanelTx(null)}
        title="Операция в журнале"
        subtitle={panelTx ? String(panelTx.transaction_date) : undefined}
      >
        {panelTx && (
          <TransactionSideContent tx={panelTx} allItems={(txQuery.data?.items as any[]) || []} onClose={() => setPanelTx(null)} />
        )}
      </WorkflowSidePanel>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-white/[0.08] bg-[rgb(var(--color-surface)/0.92)] p-3 backdrop-blur-xl lg:hidden">
        <button type="button" className="btn-secondary min-h-12 flex-1 text-sm font-bold" onClick={() => setWorkspaceFocus('ledger')}>
          Журнал
        </button>
        <button type="button" className="btn-primary min-h-12 flex-1 text-sm font-bold" onClick={() => setWorkspaceFocus('capture')}>
          Ввод
        </button>
        <Link to="/scan" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" aria-label="Сканер">
          <Icon name="document_scanner" className="text-2xl" />
        </Link>
      </div>
    </section>
  )
}
