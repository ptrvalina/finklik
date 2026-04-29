import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('other')
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [source, setSource] = useState<'manual' | 'scan' | 'bank'>('manual')
  const [receiptUrl, setReceiptUrl] = useState('')

  const aiSuggestion = useMemo(() => suggestCategory(description), [description])

  const txQuery = useQuery({
    queryKey: ['transactions', 'accounting'],
    queryFn: () => dashboardApi.getTransactions({ per_page: 30 }).then((r) => r.data),
  })

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

  const createMutation = useMutation({
    mutationFn: () =>
      dashboardApi.createTransaction({
        type,
        amount: Number(amount || 0),
        vat_amount: 0,
        category,
        description: `[${source}] ${description}${receiptUrl ? ` | receipt:${receiptUrl}` : ''} | ai_conf:${aiSuggestion.confidence}`,
        transaction_date: transactionDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setAmount('')
      setDescription('')
      setReceiptUrl('')
      setSource('manual')
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
    <section className="space-y-4">
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">Учет (КУДиР)</h1>
            <p className="mt-2 text-on-surface-variant">Автозаполнение из сканов/банка и AI-классификация расходов.</p>
          </div>
          <button className="btn-secondary" onClick={downloadKudir}>Скачать КУДиР</button>
        </div>
      </div>

      <form className="card-elevated grid gap-3 p-6 md:grid-cols-2" onSubmit={submit}>
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
          <div className="rounded-xl border border-outline/70 px-3 py-2 text-sm">
            AI: {aiSuggestion.category} ({Math.round(aiSuggestion.confidence * 100)}%)
          </div>
        </div>
        <div className="md:col-span-2 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input type="file" className="input" onChange={(e) => setScanFile(e.target.files?.[0] || null)} />
          <button type="button" className="btn-secondary" onClick={() => uploadScanMutation.mutate()} disabled={!scanFile || uploadScanMutation.isPending}>
            OCR из скана
          </button>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Добавить в КУДиР</button>
        </div>
      </form>

      <div className="card-elevated p-5">
        <h2 className="mb-3 text-lg font-semibold">Записи</h2>
        <div className="space-y-2">
          {(txQuery.data?.items || []).map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between rounded-lg border border-outline/60 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-on-surface-variant">{tx.transaction_date} · {tx.category || 'other'}</p>
              </div>
              <span>{tx.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
