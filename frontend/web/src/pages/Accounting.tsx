import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { dashboardApi, documentsApi, scannerApi } from '../api/client'
import { DataTableShell, useDataTableSelection } from '../components/datatable'
import { JournalCommandPalette } from '../components/journal/JournalCommandPalette'
import { JournalMobileVirtualList } from '../components/journal/JournalMobileVirtualList'
import { JournalQuickStrip } from '../components/journal/JournalQuickStrip'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import { WorkflowSidePanel, WorkflowCompletionBanner } from '../components/workflow'
import {
  JOURNAL_CATEGORY_KEYS,
  JOURNAL_CATEGORY_LABELS,
  suggestJournalCategory,
} from '../lib/journalCategories'
import { loadJournalUiSession, saveJournalUiSession } from '../lib/journalUiSession'
import { orgQueryKey } from '../lib/queryKeys'
import { useAuthStore } from '../store/authStore'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'
import { JournalHotkeysHelp } from '../components/journal/JournalHotkeysHelp'

/** Совместимость: прежний экспорт для тестов / импортов */
export function suggestCategory(text: string) {
  return suggestJournalCategory(text)
}

function fmt(n: number) {
  return n.toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Полное тело PUT /transactions для сохранения полей операции (инлайн и панель). */
function buildTxUpdateBody(tx: any, patch: Partial<{ category: string; description: string; amount: number }>) {
  return {
    type: tx.type,
    amount: patch.amount ?? Number(tx.amount),
    vat_amount: Number(tx.vat_amount ?? 0),
    counterparty_id: tx.counterparty_id ?? undefined,
    category: patch.category ?? tx.category ?? undefined,
    description: patch.description ?? tx.description ?? undefined,
    source: tx.source || 'manual',
    ai_category_confidence: tx.ai_category_confidence ?? undefined,
    receipt_image_url: tx.receipt_image_url ?? undefined,
    transaction_date: tx.transaction_date,
    cost_center_id: tx.cost_center_id ?? undefined,
    revenue_stream_id: tx.revenue_stream_id ?? undefined,
  }
}

const FC_JOURNAL_CAT = 'fc_journal_cat_v1'
const FC_JOURNAL_AMOUNTS = 'fc_journal_amounts_v1'

function loadJournalCatPrefs(): { income: string; expense: string } {
  try {
    const r = localStorage.getItem(FC_JOURNAL_CAT)
    if (!r) return { income: 'other', expense: 'other' }
    const j = JSON.parse(r) as { income?: string; expense?: string }
    const keys = JOURNAL_CATEGORY_KEYS as readonly string[]
    const inc = j.income && keys.includes(j.income) ? j.income : 'other'
    const exp = j.expense && keys.includes(j.expense) ? j.expense : 'other'
    return { income: inc, expense: exp }
  } catch {
    return { income: 'other', expense: 'other' }
  }
}

function saveJournalCatPrefs(part: Partial<{ income: string; expense: string }>) {
  try {
    const cur = loadJournalCatPrefs()
    localStorage.setItem(FC_JOURNAL_CAT, JSON.stringify({ ...cur, ...part }))
  } catch {
    /* ignore */
  }
}

function loadAmountPresets(): string[] {
  try {
    const r = localStorage.getItem(FC_JOURNAL_AMOUNTS)
    if (!r) return []
    const arr = JSON.parse(r) as unknown
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

function pushAmountPreset(amountStr: string) {
  const n = Number(amountStr)
  if (!(n > 0)) return
  try {
    const s = String(n)
    const prev = loadAmountPresets()
    const next = [s, ...prev.filter((x) => x !== s)].slice(0, 8)
    localStorage.setItem(FC_JOURNAL_AMOUNTS, JSON.stringify(next))
  } catch {
    /* ignore */
  }
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
  ledgerQueryKey,
}: {
  tx: any
  allItems: any[]
  onClose: () => void
  /** Ключ кэша журнала (с org) — узкая инвалидация без «глушения» всего префикса transactions */
  ledgerQueryKey: readonly unknown[]
}) {
  const qc = useQueryClient()
  const suggestion = useMemo(() => suggestJournalCategory(String(tx.description || '')), [tx.description])
  const [category, setCategory] = useState(tx.category || 'other')
  const [description, setDescription] = useState(tx.description || '')
  const [amount, setAmount] = useState(String(tx.amount ?? ''))
  const duplicates = useMemo(() => findDuplicateTx(tx, allItems), [tx, allItems])

  const aiStored = useMemo(() => {
    if (!tx.ai_analysis_json) return null
    try {
      return JSON.parse(tx.ai_analysis_json) as { reasoning?: string; suggested_category?: string; confidence?: number }
    } catch {
      return null
    }
  }, [tx.ai_analysis_json])

  useEffect(() => {
    setCategory(tx.category || 'other')
    setDescription(tx.description || '')
    setAmount(String(tx.amount ?? ''))
  }, [tx.id, tx.category, tx.description, tx.amount])

  const updateMutation = useMutation({
    mutationFn: () =>
      dashboardApi.updateTransaction(
        tx.id,
        buildTxUpdateBody(tx, {
          amount: parseFloat(amount || '0'),
          category,
          description,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ledgerQueryKey, exact: true })
      void qc.invalidateQueries({ queryKey: ['transactions', 'recent'], exact: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'], exact: true })
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

      {aiStored?.reasoning && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-on-surface">
          <p className="font-bold uppercase tracking-wider text-emerald-700/90 dark:text-emerald-300/90">Разбор ИИ</p>
          <p className="mt-1 leading-relaxed text-on-surface-variant">{aiStored.reasoning}</p>
        </div>
      )}

      <div>
        <label className="label">ИИ · категория</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {JOURNAL_CATEGORY_LABELS[suggestion.category] || suggestion.category}{' '}
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
          {JOURNAL_CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>
              {JOURNAL_CATEGORY_LABELS[k] || k}
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
  const [category, setCategory] = useState(() => loadJournalCatPrefs().expense)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [source, setSource] = useState<'manual' | 'scan' | 'bank'>('manual')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(monthStartStr)
  const [filterDateTo, setFilterDateTo] = useState(todayStr)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'drafts'>('all')
  const [linkedCounterpartyId, setLinkedCounterpartyId] = useState<string | null>(null)
  const [panelTx, setPanelTx] = useState<any | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [hotkeysOpen, setHotkeysOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null)
  const captureAmountRef = useRef<HTMLInputElement>(null)
  const filterSearchRef = useRef<HTMLInputElement>(null)
  const [scanDropActive, setScanDropActive] = useState(false)
  const [amountPresets, setAmountPresets] = useState<string[]>(() => loadAmountPresets())

  const orgId = useAuthStore((s) => s.user?.organization_id ?? '')
  const journalSaveReady = useRef(false)

  useLayoutEffect(() => {
    if (!orgId) return
    journalSaveReady.current = false
    const snap = loadJournalUiSession(orgId)
    if (snap) {
      setFilterDateFrom(snap.filterDateFrom)
      setFilterDateTo(snap.filterDateTo)
      setFilterType(snap.filterType)
      setFilterSearch(snap.filterSearch)
      setAttentionFilter(snap.attentionFilter)
      setWorkspaceFocus(snap.workspaceFocus)
    } else {
      setFilterDateFrom(monthStartStr)
      setFilterDateTo(todayStr)
      setFilterType('all')
      setFilterSearch('')
      setAttentionFilter('all')
      setWorkspaceFocus('ledger')
    }
    journalSaveReady.current = true
    // monthStartStr / todayStr read from render — only org boundary should rehydrate.
  }, [orgId])

  useEffect(() => {
    if (!orgId || !journalSaveReady.current) return
    const t = window.setTimeout(() => {
      saveJournalUiSession(orgId, {
        v: 1,
        filterDateFrom,
        filterDateTo,
        filterType,
        filterSearch,
        attentionFilter,
        workspaceFocus,
      })
    }, 450)
    return () => window.clearTimeout(t)
  }, [orgId, filterDateFrom, filterDateTo, filterType, filterSearch, attentionFilter, workspaceFocus])

  const ledgerQueryKey = useMemo(() => orgQueryKey(['transactions', 'accounting']), [orgId])

  const refreshLedgerRelated = useCallback(() => {
    if (!orgId) return
    void qc.invalidateQueries({ queryKey: ledgerQueryKey, exact: true })
    void qc.invalidateQueries({ queryKey: ['transactions', 'recent'], exact: true })
    void qc.invalidateQueries({ queryKey: ['dashboard'], exact: true })
  }, [qc, ledgerQueryKey, orgId])

  const aiSuggestion = useMemo(() => suggestJournalCategory(description), [description])

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
    queryKey: ledgerQueryKey,
    queryFn: () => dashboardApi.getTransactions({ per_page: 500 }).then((r) => r.data),
    staleTime: 25_000,
    placeholderData: (prev) => prev,
    enabled: !!orgId,
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
      if (attentionFilter === 'drafts' && tx.status !== 'draft') return false
      return true
    })
  }, [txQuery.data?.items, filterDateFrom, filterDateTo, filterType, filterSearch, attentionFilter])

  useEffect(() => {
    const txId = searchParams.get('tx_id')
    if (!txId || !txQuery.data?.items?.length) return
    const items = txQuery.data.items as any[]
    const tx = items.find((t) => String(t.id) === txId)
    if (!tx) return
    setPanelTx(tx)
    const idx = filteredItems.findIndex((t: any) => String(t.id) === txId)
    if (idx >= 0) setFocusedRowIndex(idx)
    const next = new URLSearchParams(searchParams)
    next.delete('tx_id')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, txQuery.data?.items, filteredItems])

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
      refreshLedgerRelated()
    },
  })

  const patchCategoryMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) => {
      const raw = txQuery.data?.items as any[] | undefined
      const tx = raw?.find((t) => t.id === id)
      if (!tx) throw new Error('tx')
      return dashboardApi.updateTransaction(id, buildTxUpdateBody(tx, { category }))
    },
    onMutate: async ({ id, category }) => {
      await qc.cancelQueries({ queryKey: ledgerQueryKey })
      const prev = qc.getQueryData(ledgerQueryKey) as any
      qc.setQueryData(ledgerQueryKey, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((t: any) => (t.id === id ? { ...t, category } : t)),
        }
      })
      return { prev }
    },
    onError: (_e, _v, ctx: { prev?: unknown }) => {
      if (ctx?.prev) qc.setQueryData(ledgerQueryKey, ctx.prev as any)
    },
    onSuccess: (_d, { id, category }) => {
      const raw = qc.getQueryData(ledgerQueryKey) as { items?: any[] } | undefined
      const tx = raw?.items?.find((t) => t.id === id)
      if (tx?.type === 'expense' || tx?.type === 'income') {
        saveJournalCatPrefs({ [tx.type]: category })
      }
    },
    onSettled: () => refreshLedgerRelated(),
  })

  const bulkAiCategoriesMutation = useMutation({
    mutationFn: async () => {
      const raw = txQuery.data?.items as any[] | undefined
      const ids = [...selection.selected]
      await Promise.all(
        ids.map(async (id) => {
          const tx = filteredItems.find((t: any) => t.id === id)
          if (!tx || tx.type !== 'expense') return
          const sug = suggestJournalCategory(String(tx.description || ''))
          const cur = tx.category || 'other'
          if (sug.category === cur) return
          const full = raw?.find((t) => t.id === id)
          if (!full) return
          await dashboardApi.updateTransaction(id, buildTxUpdateBody(full, { category: sug.category }))
        }),
      )
    },
    onSettled: () => {
      refreshLedgerRelated()
      selection.clear()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await dashboardApi.createTransaction({
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
      })
      return data
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ledgerQueryKey })
      const prev = qc.getQueryData(ledgerQueryKey) as any
      const tempId = `optimistic:${Date.now()}`
      const optimisticTx = {
        id: tempId,
        type,
        amount: Number(amount || 0),
        vat_amount: 0,
        category,
        description,
        source,
        transaction_date: transactionDate,
        status: 'posted',
        counterparty_id: linkedCounterpartyId ?? null,
        receipt_image_url: receiptUrl || null,
        ai_category_confidence: aiSuggestion.confidence,
      }
      qc.setQueryData(ledgerQueryKey, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          total: (Number(old.total) || 0) + 1,
          items: [optimisticTx, ...old.items],
        }
      })
      return { prev, tempId }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ledgerQueryKey, ctx.prev as any)
    },
    onSuccess: (created, _vars, ctx) => {
      const t = (created as { type?: string }).type || type
      const c = (created as { category?: string }).category || category
      if (t === 'expense' || t === 'income') saveJournalCatPrefs({ [t]: c })
      pushAmountPreset(amount)
      setAmountPresets(loadAmountPresets())
      qc.setQueryData(ledgerQueryKey, (old: any) => {
        if (!old?.items) return old
        const tid = ctx?.tempId
        return {
          ...old,
          items: old.items.map((t: any) => (tid && t.id === tid ? { ...created } : t)),
        }
      })
      setAmount('')
      setDescription('')
      setReceiptUrl('')
      setSource('manual')
      setLinkedCounterpartyId(null)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 4200)
      setWorkspaceFocus('ledger')
    },
    onSettled: () => {
      refreshLedgerRelated()
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

  const focusCaptureForm = useCallback(() => {
    setWorkspaceFocus('capture')
    window.requestAnimationFrame(() => captureAmountRef.current?.focus())
  }, [])

  const quickIncome = useCallback(() => {
    setType('income')
    setCategory(loadJournalCatPrefs().income)
    focusCaptureForm()
  }, [focusCaptureForm])

  const quickExpense = useCallback(() => {
    setType('expense')
    setCategory(loadJournalCatPrefs().expense)
    focusCaptureForm()
  }, [focusCaptureForm])

  useEffect(() => {
    setFocusedRowIndex((i) => {
      if (i === null) return null
      const max = filteredItems.length - 1
      if (max < 0) return null
      return Math.min(i, max)
    })
  }, [filteredItems])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      const inField =
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteQuery('')
        setCommandOpen(true)
        return
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inField) return
        e.preventDefault()
        focusCaptureForm()
        return
      }
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inField) return
        e.preventDefault()
        quickIncome()
        return
      }
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inField) return
        e.preventDefault()
        quickExpense()
        return
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setWorkspaceFocus('ledger')
        window.requestAnimationFrame(() => filterSearchRef.current?.focus())
        return
      }
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inField) return
        e.preventDefault()
        setWorkspaceFocus('ledger')
        return
      }
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (inField) return
        e.preventDefault()
        setAttentionFilter((f) => (f === 'drafts' ? 'all' : 'drafts'))
        setWorkspaceFocus('ledger')
        return
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setHotkeysOpen((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        if (hotkeysOpen) {
          setHotkeysOpen(false)
          return
        }
        setCommandOpen(false)
        setPanelTx(null)
        setFocusedRowIndex(null)
        return
      }
      if (commandOpen || panelTx) return
      if (inField) return
      const n = filteredItems.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedRowIndex((i) => (i === null ? 0 : Math.min(i + 1, Math.max(n - 1, 0))))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedRowIndex((i) => (i === null ? Math.max(n - 1, 0) : Math.max(i - 1, 0)))
      }
      if (e.key === 'Enter' && focusedRowIndex !== null && filteredItems[focusedRowIndex]) {
        e.preventDefault()
        setPanelTx(filteredItems[focusedRowIndex])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filteredItems, commandOpen, panelTx, focusCaptureForm, focusedRowIndex, quickIncome, quickExpense, hotkeysOpen])

  const isLoading = txQuery.isLoading

  return (
    <OperationalPage
      className="accounting-journal pb-24 lg:pb-8"
      eyebrow="Учёт"
      title="Журнал операций"
      description={
        linkedCounterpartyId
          ? 'Следующая проводка привязана к контрагенту из справочника. Строка — Enter, навигация — стрелки.'
          : 'Ctrl+K — команды, N/I/E — ввод, / — поиск, ? — подсказки по клавишам.'
      }
      primaryAction={
        <button type="button" className="btn-primary fc-btn-thumb shrink-0 rounded-[1rem]" onClick={() => setCommandOpen(true)}>
          <Icon name="keyboard_command_key" className="text-lg" /> Команды
        </button>
      }
      secondaryActions={
        <>
          <button type="button" className="btn-ghost shrink-0 rounded-[1rem] text-xs" onClick={() => setHotkeysOpen((v) => !v)}>
            ?
          </button>
          <Link to="/accounting/hub" className="btn-ghost shrink-0 rounded-[1rem] text-xs">
            <Icon name="apps" className="text-lg" /> Хаб учёта
          </Link>
          <button type="button" className="btn-secondary shrink-0 rounded-[1rem]" onClick={downloadKudir}>
            КУДиР
          </button>
          <Link to="/scan" className="btn-secondary shrink-0 rounded-[1rem]">
            <Icon name="document_scanner" className="text-lg" /> Сканер
          </Link>
        </>
      }
    >
      {hotkeysOpen && <JournalHotkeysHelp onClose={() => setHotkeysOpen(false)} />}

      <div className="card-elevated relative overflow-hidden rounded-3xl p-4 shadow-lift ring-1 ring-primary/[0.06] sm:p-6">
        <div className="flex flex-wrap gap-2 border-b border-outline/30 pb-4">
          <Link to="/bank" className="btn-ghost shrink-0 rounded-[1rem] text-xs">
            <Icon name="sync_alt" className="text-lg" /> Банк
          </Link>
          <Link to="/documents" className="btn-ghost shrink-0 rounded-[1rem] text-xs">
            <Icon name="folder_open" className="text-lg" /> Документы
          </Link>
          <Link to="/accounting/fixed-assets" className="btn-ghost shrink-0 rounded-[1rem] text-xs">
            <Icon name="inventory_2" className="text-lg" /> ОС
          </Link>
          <Link to="/operations" className="btn-ghost shrink-0 rounded-[1rem] text-xs">
            <Icon name="bolt" className="text-lg" /> Лента
          </Link>
        </div>

        <div className="mt-4 flex gap-1 rounded-full border border-outline/60 bg-surface-container-low/80 p-1">
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

      {stats.drafts > 0 && (
        <div className="mt-4">
          <FocusStrip
            tone="amber"
            headline={`${stats.drafts} ${stats.drafts === 1 ? 'черновик' : 'черновика'} в журнале`}
            supporting="Проведите операции — иначе отчётность и налоги будут неполными."
            ctaLabel="Показать черновики"
            onCta={() => setAttentionFilter('drafts')}
          />
        </div>
      )}

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
            <select
              className="input min-h-11 rounded-xl"
              value={type}
              onChange={(e) => {
                const nt = e.target.value as 'income' | 'expense'
                setType(nt)
                setCategory(loadJournalCatPrefs()[nt])
              }}
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <input className="input min-h-11 rounded-xl" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
            <div className="flex flex-col gap-2">
              <input
                ref={captureAmountRef}
                className="input min-h-11 rounded-xl"
                placeholder="Сумма"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
              {amountPresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {amountPresets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-lg border border-outline-variant/40 bg-surface-container-low/80 px-2.5 py-1 text-xs font-semibold tabular-nums text-on-surface hover:border-primary/35"
                      onClick={() => setAmount(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                {JOURNAL_CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {JOURNAL_CATEGORY_LABELS[k] || k}
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
                <span className="font-semibold text-primary">ИИ:</span> {JOURNAL_CATEGORY_LABELS[aiSuggestion.category]}{' '}
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
            <div
              className={`md:col-span-2 rounded-3xl border-2 border-dashed p-5 shadow-inner backdrop-blur-sm transition-colors ${
                scanDropActive
                  ? 'border-primary/60 bg-primary/[0.08]'
                  : 'border-emerald-400/35 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-cyan-500/[0.05] dark:border-emerald-400/25'
              }`}
              onDragEnter={(e) => {
                e.preventDefault()
                setScanDropActive(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDragLeave={() => setScanDropActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setScanDropActive(false)
                const f = e.dataTransfer.files?.[0]
                if (f) setScanFile(f)
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Icon name="document_scanner" className="text-xl" />
                </span>
                <div>
                  <p className="font-headline text-sm font-bold text-on-surface">OCR · загрузка скана</p>
                  <p className="text-xs text-on-surface-variant">Перетащите файл сюда или выберите с диска — поля подставятся в форму.</p>
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
                  ref={filterSearchRef}
                  className="input min-h-11 rounded-xl"
                  placeholder="Поиск по описанию (/)"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex gap-1 rounded-full border border-outline-variant/30 bg-surface/80 p-0.5">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      attentionFilter === 'all' ? 'bg-emerald-600 text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    onClick={() => setAttentionFilter('all')}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      attentionFilter === 'drafts' ? 'bg-amber-500/90 text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    onClick={() => setAttentionFilter('drafts')}
                  >
                    Черновики
                  </button>
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
                <p className="hidden text-[10px] text-on-surface-variant xl:block">
                  <kbd className="rounded bg-surface-container-high px-1">⌘K</kbd> палитра ·{' '}
                  <kbd className="rounded bg-surface-container-high px-1">N</kbd> ввод ·{' '}
                  <kbd className="rounded bg-surface-container-high px-1">↑↓</kbd> строки ·{' '}
                  <kbd className="rounded bg-surface-container-high px-1">Enter</kbd> панель
                </p>
              </div>
            </div>
          }
          bulkBar={
            <>
              <span className="text-xs font-medium text-on-surface-variant">Выбрано: {selection.selectedCount}</span>
              <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => selection.clear()}>
                Очистить
              </button>
              <button
                type="button"
                className="btn-secondary min-h-9 px-4 text-xs font-bold"
                disabled={selection.selectedCount === 0 || bulkAiCategoriesMutation.isPending}
                onClick={() => bulkAiCategoriesMutation.mutate()}
              >
                {bulkAiCategoriesMutation.isPending ? 'ИИ…' : 'ИИ: категории'}
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
                  <button type="button" className="btn-primary mt-4 min-h-11 px-4" onClick={() => focusCaptureForm()}>
                    Добавить операцию
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <JournalMobileVirtualList
                items={filteredItems as Record<string, unknown>[]}
                focusedRowIndex={focusedRowIndex}
                selection={selection}
                onOpenRow={(tx) => setPanelTx(tx)}
              />

              <div className="fc-premium-table fc-premium-table-scroll fc-premium-table--sticky hidden md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="w-10 px-2.5 py-2">
                        <input
                          type="checkbox"
                          className="rounded border-outline-variant"
                          checked={selection.allVisibleSelected}
                          onChange={() => selection.toggleAllVisible()}
                          aria-label="Выбрать все"
                        />
                      </th>
                      <th className="px-2.5 py-2 text-right text-[10px] font-semibold">Сумма</th>
                      <th className="px-2.5 py-2 text-[10px] font-semibold">Дата</th>
                      <th className="px-2.5 py-2 text-[10px] font-semibold">Описание</th>
                      <th className="px-2.5 py-2 text-[10px] font-semibold">Категория</th>
                      <th className="w-24 px-2.5 py-2 text-right text-[10px] font-semibold">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {(filteredItems as any[]).map((tx: any, idx: number) => {
                      const sug = suggestJournalCategory(String(tx.description || ''))
                      const aiMismatch = tx.type === 'expense' && sug.category !== (tx.category || 'other')
                      const accent =
                        tx.status === 'draft'
                          ? 'border-l-[2px] border-amber-400/70'
                          : aiMismatch
                            ? 'border-l-[2px] border-emerald-500/30'
                            : ''
                      const focusRing =
                        focusedRowIndex === idx ? 'ring-1 ring-inset ring-primary/18 bg-primary/[0.03]' : ''
                      const rowPending =
                        patchCategoryMutation.isPending && patchCategoryMutation.variables?.id === tx.id
                      return (
                        <tr
                          key={tx.id}
                          className={`accounting-journal-row cursor-pointer transition-[background-color,box-shadow] duration-[var(--fc-duration-fast)] ease-premium ${accent} ${focusRing}`}
                          onClick={() => setPanelTx(tx)}
                        >
                          <td className="px-2.5 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-outline-variant"
                              checked={selection.isSelected(String(tx.id))}
                              onChange={() => selection.toggle(String(tx.id))}
                              aria-label="Выбрать"
                            />
                          </td>
                          <td
                            className={`px-2.5 py-2 text-right align-middle text-[15px] font-bold tabular-nums tracking-tight ${
                              tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '−'}
                            {fmt(Number(tx.amount))}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2 align-middle text-[11px] tabular-nums text-on-surface-variant/85">
                            {tx.transaction_date}
                          </td>
                          <td className="max-w-[min(280px,28vw)] px-2.5 py-2 align-middle">
                            <p className="truncate text-[13px] font-normal leading-snug text-on-surface-variant">
                              {tx.description || '—'}
                            </p>
                            {aiMismatch && (
                              <span className="mt-0.5 inline-block text-[10px] font-medium text-emerald-600/75 dark:text-emerald-400/75">
                                ИИ → {JOURNAL_CATEGORY_LABELS[sug.category]}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                            <select
                              className="input max-w-[140px] min-h-8 rounded-lg border-outline/50 bg-surface/60 py-1 text-[11px] font-medium text-on-surface-variant shadow-none backdrop-blur-sm transition-opacity dark:bg-white/[0.04]"
                              value={tx.category || 'other'}
                              onChange={(e) =>
                                patchCategoryMutation.mutate({ id: tx.id, category: e.target.value })
                              }
                              disabled={rowPending}
                              aria-busy={rowPending}
                            >
                              {JOURNAL_CATEGORY_KEYS.map((k) => (
                                <option key={k} value={k}>
                                  {JOURNAL_CATEGORY_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2.5 py-2 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn-ghost min-h-8 px-2 text-[11px] font-medium text-primary"
                              onClick={() => setPanelTx(tx)}
                            >
                              Обзор
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DataTableShell>
      </div>

      <JournalQuickStrip onIncome={quickIncome} onExpense={quickExpense} onFocusCapture={focusCaptureForm} />

      <JournalCommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        transactions={(txQuery.data?.items as any[]) || []}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        onPickTransaction={(t) => setPanelTx(t)}
        onGoCapture={() => {
          focusCaptureForm()
          setCommandOpen(false)
        }}
        onQuickExpense={quickExpense}
        onQuickIncome={quickIncome}
        onClearFilters={() => {
          setFilterDateFrom(monthStartStr)
          setFilterDateTo(todayStr)
          setFilterType('all')
          setFilterSearch('')
          setAttentionFilter('all')
        }}
      />

      <WorkflowSidePanel
        open={!!panelTx}
        onClose={() => setPanelTx(null)}
        title="Операция в журнале"
        subtitle={panelTx ? String(panelTx.transaction_date) : undefined}
      >
        {panelTx && (
          <TransactionSideContent
            tx={panelTx}
            allItems={(txQuery.data?.items as any[]) || []}
            onClose={() => setPanelTx(null)}
            ledgerQueryKey={ledgerQueryKey}
          />
        )}
      </WorkflowSidePanel>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-outline/40 bg-[rgb(var(--color-surface)/0.94)] px-3 pt-2.5 backdrop-blur-xl supports-[backdrop-filter]:bg-[rgb(var(--color-surface)/0.88)] pb-[max(0.65rem,env(safe-area-inset-bottom))] dark:border-white/[0.07] lg:hidden">
        <button type="button" className="btn-secondary min-h-11 flex-1 text-sm font-semibold" onClick={() => setWorkspaceFocus('ledger')}>
          Журнал
        </button>
        <button type="button" className="btn-primary min-h-11 flex-1 text-sm font-semibold" onClick={() => focusCaptureForm()}>
          Ввод
        </button>
        <Link
          to="/scan"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-outline/35 bg-surface/80 text-emerald-700 shadow-xs dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-emerald-300"
          aria-label="Сканер"
        >
          <Icon name="document_scanner" className="text-[1.35rem]" />
        </Link>
      </div>
    </OperationalPage>
  )
}
