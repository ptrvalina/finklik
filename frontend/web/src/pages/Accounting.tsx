import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { dashboardApi, documentsApi, scannerApi } from '../api/client'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  rent: ['аренда', 'офис', 'помещение'],
  tax: ['налог', 'фсзн', 'ндс'],
  advertising: ['реклама', 'ads', 'маркетинг'],
  goods: ['товар', 'закупка', 'склад'],
}

function suggestCategory(text: string) {
  const value = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((word) => value.includes(word))) return { category, confidence: 0.82 }
  }
  return { category: 'other', confidence: 0.51 }
}

export default function Accounting() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const monthStartStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
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
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [linkedCounterpartyId, setLinkedCounterpartyId] = useState<string | null>(null)

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
    queryFn: () => dashboardApi.getTransactions({ per_page: 200 }).then((r) => r.data),
  })
  const filteredItems = useMemo(() => {
    const items = txQuery.data?.items || []
    return items.filter((tx: any) => {
      const txDate = String(tx.transaction_date || '')
      if (filterDateFrom && txDate < filterDateFrom) return false
      if (filterDateTo && txDate > filterDateTo) return false
      if (filterType !== 'all' && tx.type !== filterType) return false
      if (filterCategory !== 'all' && (tx.category || 'other') !== filterCategory) return false
      if (filterSearch.trim()) {
        const term = filterSearch.trim().toLowerCase()
        const hay = `${tx.description || ''} ${tx.category || ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [txQuery.data?.items, filterDateFrom, filterDateTo, filterType, filterCategory, filterSearch])

  const uploadScanMutation = useMutation({
    mutationFn: async () => {
      if (!scanFile) return null
      const response = await scannerApi.upload(scanFile)
      const parsed = response.data?.parsed || {}
      setDescription((d) => d || parsed?.description || '')
      setAmount((a) => a || String(parsed?.amount || ''))
      setTransactionDate((v) => (parsed?.date ? String(parsed.date).slice(0, 10) : v))
      setSource('scan')
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

  return (
    <section className="fc-page-shell">
      <div className="card-elevated relative overflow-hidden rounded-[1.25rem] p-6 shadow-lift ring-1 ring-primary/[0.06]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-[#004d40]" aria-hidden />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-heading text-[1.65rem] sm:text-3xl">Учёт (КУДиР)</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Автозаполнение из сканов/банка и AI-классификация расходов.</p>
            {linkedCounterpartyId ? (
              <p className="mt-2 text-xs font-medium text-primary">
                Привязка к контрагенту активна для следующей операции (из раздела «Контрагенты»).
              </p>
            ) : null}
          </div>
          <button type="button" className="btn-secondary shrink-0 rounded-[1rem]" onClick={downloadKudir}>
            Скачать КУДиР
          </button>
        </div>
      </div>

      <form className="card-elevated grid gap-3 rounded-[1.25rem] p-6 shadow-card ring-1 ring-primary/[0.05] md:grid-cols-2" onSubmit={submit}>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <input className="input" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
        <input className="input" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="input" value={source} onChange={(e) => setSource(e.target.value as any)}>
          <option value="manual">manual</option>
          <option value="scan">scan</option>
          <option value="bank">bank</option>
        </select>
        <textarea className="input md:col-span-2 min-h-[90px]" placeholder="Описание / назначение" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="rent">arenda</option>
            <option value="tax">nalog</option>
            <option value="advertising">reklama</option>
            <option value="goods">tovary</option>
            <option value="other">other</option>
          </select>
          <input className="input" placeholder="URL чека (receipt_image_url)" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} />
          <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-on-surface">
            <span className="font-semibold text-primary">AI:</span> {aiSuggestion.category}{' '}
            <span className="text-on-surface-variant">({Math.round(aiSuggestion.confidence * 100)}%)</span>
          </div>
        </div>
        <div className="md:col-span-2 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input type="file" className="input" onChange={(e) => setScanFile(e.target.files?.[0] || null)} />
          <button type="button" className="btn-secondary" onClick={() => uploadScanMutation.mutate()} disabled={!scanFile || uploadScanMutation.isPending}>
            OCR из скана
          </button>
          <button type="button" className="btn-secondary" onClick={() => uploadToKudirMutation.mutate()} disabled={!scanFile || uploadToKudirMutation.isPending}>
            OCR + AI + в КУДиР
          </button>
          <button type="submit" className="btn-primary rounded-[1rem]" disabled={createMutation.isPending}>
            Добавить в КУДиР
          </button>
        </div>
      </form>

      <div className="card-elevated rounded-[1.25rem] p-5 shadow-card ring-1 ring-primary/[0.05]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-headline text-lg font-bold text-on-surface">Записи</h2>
          <div className="inline-flex gap-1 rounded-full border border-outline/70 bg-surface-container-low/80 p-1">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface hover:text-on-surface"
              onClick={() => {
                setFilterDateFrom(monthStartStr)
                setFilterDateTo(todayStr)
              }}
            >
              Этот месяц
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface hover:text-on-surface"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 30)
                setFilterDateFrom(d.toISOString().slice(0, 10))
                setFilterDateTo(todayStr)
              }}
            >
              30 дней
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface hover:text-on-surface"
              onClick={() => {
                setFilterDateFrom('')
                setFilterDateTo(todayStr)
              }}
            >
              Все
            </button>
          </div>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-5">
          <input className="input" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          <input className="input" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
            <option value="all">Все типы</option>
            <option value="income">Доход</option>
            <option value="expense">Расход</option>
          </select>
          <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">Все категории</option>
            <option value="rent">Аренда</option>
            <option value="tax">Налоги</option>
            <option value="advertising">Реклама</option>
            <option value="goods">Товары</option>
            <option value="other">Прочее</option>
          </select>
          <input className="input" placeholder="Поиск" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
        </div>
        <div className="divide-y divide-outline/50 overflow-hidden rounded-2xl border border-outline/60 bg-surface">
          {filteredItems.map((tx: any) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-primary/[0.03]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-on-surface">{tx.description}</p>
                <p className="text-xs text-on-surface-variant">
                  {tx.transaction_date} · {tx.category || 'other'}
                </p>
              </div>
              <span className="shrink-0 font-headline font-bold tabular-nums text-on-surface">{tx.amount}</span>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-on-surface-variant">Нет записей по выбранным фильтрам.</p>
          )}
        </div>
      </div>
    </section>
  )
}
