import { useState, useRef } from 'react'
import { counterpartiesApi, documentsApi, importApi, primaryDocumentsApi } from '../api/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export default function DocumentsPage() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(todayStr)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [vatQuarter, setVatQuarter] = useState(Math.ceil((today.getMonth() + 1) / 3))
  const [vatYear, setVatYear] = useState(today.getFullYear())
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function download(handler: () => Promise<any>, name: string, key: string) {
    try { setLoading(key); const r = await handler(); saveBlob(r.data, name); setMessage({ type: 'success', text: `"${name}" скачан` }) }
    catch { setMessage({ type: 'error', text: 'Не удалось скачать файл' }) }
    finally { setLoading(null) }
  }

  const docs = [
    {
      title: 'Финансовый отчёт', subtitle: 'Сводный отчёт за период', icon: 'picture_as_pdf', format: 'PDF',
      fields: (
        <>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </>
      ),
      action: () => download(() => documentsApi.financialReportPdf(dateFrom, dateTo), `financial_report_${dateFrom}_${dateTo}.pdf`, 'pdf'),
      loadKey: 'pdf',
    },
    {
      title: 'Транзакции', subtitle: 'Выгрузка всех операций', icon: 'receipt_long', format: 'CSV',
      fields: (
        <>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </>
      ),
      action: () => download(() => documentsApi.transactionsCsv(dateFrom, dateTo), `transactions_${dateFrom}_${dateTo}.csv`, 'tx'),
      loadKey: 'tx',
    },
    {
      title: 'Зарплаты', subtitle: 'Ведомость за месяц', icon: 'payments', format: 'CSV',
      fields: (
        <>
          <input type="number" className="input" value={year} onChange={e => setYear(Number(e.target.value))} placeholder="Год" />
          <input type="number" className="input" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} placeholder="Месяц" />
        </>
      ),
      action: () => download(() => documentsApi.salaryCsv(year, month), `salary_${year}_${String(month).padStart(2,'0')}.csv`, 'salary'),
      loadKey: 'salary',
    },
    {
      title: 'Налоговый отчёт', subtitle: 'Сводка по налогам', icon: 'summarize', format: 'TXT',
      fields: (
        <>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </>
      ),
      action: () => download(() => documentsApi.taxReport(dateFrom, dateTo), `tax_report_${dateFrom}_${dateTo}.txt`, 'tax'),
      loadKey: 'tax',
    },
    {
      title: 'Декларация НДС', subtitle: 'Ежеквартальная', icon: 'article', format: 'TXT',
      fields: (
        <>
          <select className="input" value={vatQuarter} onChange={e => setVatQuarter(Number(e.target.value))}>
            <option value={1}>Q1 (янв–мар)</option><option value={2}>Q2 (апр–июн)</option><option value={3}>Q3 (июл–сен)</option><option value={4}>Q4 (окт–дек)</option>
          </select>
          <input type="number" className="input" value={vatYear} onChange={e => setVatYear(Number(e.target.value))} />
        </>
      ),
      action: () => download(() => documentsApi.vatDeclaration(vatQuarter, vatYear), `vat_Q${vatQuarter}_${vatYear}.txt`, 'vat'),
      loadKey: 'vat',
    },
    {
      title: 'ФСЗН (ПУ-3)', subtitle: 'Отчёт по форме ПУ-3', icon: 'shield', format: 'TXT',
      fields: (
        <>
          <select className="input" value={vatQuarter} onChange={e => setVatQuarter(Number(e.target.value))}>
            <option value={1}>Q1</option><option value={2}>Q2</option><option value={3}>Q3</option><option value={4}>Q4</option>
          </select>
          <input type="number" className="input" value={vatYear} onChange={e => setVatYear(Number(e.target.value))} />
        </>
      ),
      action: () => download(() => documentsApi.fssznPu3(vatQuarter, vatYear), `fsszn_pu3_Q${vatQuarter}_${vatYear}.txt`, 'pu3'),
      loadKey: 'pu3',
    },
  ]

  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState<any>(null)
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [docStatusFilter, setDocStatusFilter] = useState('')
  const [useAutoNumber, setUseAutoNumber] = useState(true)
  const [docForm, setDocForm] = useState({
    doc_type: 'invoice',
    doc_number: '',
    status: 'draft',
    issue_date: todayStr,
    due_date: '',
    currency: 'BYN',
    amount_total: '',
    title: '',
    description: '',
    counterparty_id: '',
    related_document_id: '',
  })

  const { data: primaryDocsData, isLoading: primaryDocsLoading } = useQuery({
    queryKey: ['primary-documents', docTypeFilter, docStatusFilter],
    queryFn: () =>
      primaryDocumentsApi
        .list({
          doc_type: docTypeFilter || undefined,
          status: docStatusFilter || undefined,
        })
        .then((r) => r.data),
  })

  const { data: counterpartiesData } = useQuery({
    queryKey: ['counterparties', 'short'],
    queryFn: () => counterpartiesApi.list().then((r) => r.data as any[]),
  })

  const { data: nextNumPreview } = useQuery({
    queryKey: ['primary-documents', 'next-number', docForm.doc_type],
    queryFn: () => primaryDocumentsApi.nextNumber(docForm.doc_type).then((r) => r.data),
    enabled: useAutoNumber,
  })

  const { data: invoiceListForLink } = useQuery({
    queryKey: ['primary-documents', 'invoices-for-link'],
    queryFn: () => primaryDocumentsApi.list({ doc_type: 'invoice' }).then((r) => r.data as any[]),
  })

  const invoiceOptions = Array.isArray(invoiceListForLink) ? invoiceListForLink : []

  const createPrimaryDocMutation = useMutation({
    mutationFn: () =>
      primaryDocumentsApi.create({
        doc_type: docForm.doc_type,
        status: docForm.status,
        issue_date: docForm.issue_date,
        due_date: docForm.due_date || null,
        currency: docForm.currency,
        amount_total: Number(docForm.amount_total || 0),
        title: docForm.title || null,
        description: docForm.description || null,
        use_auto_number: useAutoNumber,
        ...(!useAutoNumber ? { doc_number: docForm.doc_number.trim() } : {}),
        counterparty_id: docForm.counterparty_id || null,
        related_document_id:
          docForm.doc_type === 'act' || docForm.doc_type === 'waybill'
            ? docForm.related_document_id || null
            : null,
      }),
    onSuccess: () => {
      setDocForm({
        doc_type: 'invoice',
        doc_number: '',
        status: 'draft',
        issue_date: todayStr,
        due_date: '',
        currency: 'BYN',
        amount_total: '',
        title: '',
        description: '',
        counterparty_id: '',
        related_document_id: '',
      })
      qc.invalidateQueries({ queryKey: ['primary-documents'] })
      qc.invalidateQueries({ queryKey: ['primary-documents', 'next-number'] })
      qc.invalidateQueries({ queryKey: ['primary-documents', 'invoices-for-link'] })
      setMessage({ type: 'success', text: 'Документ создан' })
    },
    onError: (e: any) => {
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Ошибка создания документа' })
    },
  })

  const deletePrimaryDocMutation = useMutation({
    mutationFn: (id: string) => primaryDocumentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['primary-documents'] })
      setMessage({ type: 'success', text: 'Документ удален' })
    },
    onError: () => setMessage({ type: 'error', text: 'Ошибка удаления документа' }),
  })

  const printPrimaryDocMutation = useMutation({
    mutationFn: async (row: { id: string; doc_number: string; doc_type: string }) => {
      const r = await primaryDocumentsApi.print(row.id)
      return { blob: r.data as Blob, ...row }
    },
    onSuccess: ({ blob, doc_number, doc_type }) => {
      const safe = `${doc_type}_${doc_number}`.replace(/[^\w.\-А-Яа-яЁё]/g, '_')
      saveBlob(blob, `${safe.slice(0, 120)}.pdf`)
      setMessage({ type: 'success', text: `PDF скачан: ${doc_number}` })
    },
    onError: () => setMessage({ type: 'error', text: 'Ошибка формирования PDF' }),
  })

  async function handleCsvPreview(file: File) {
    setCsvFile(file)
    setCsvResult(null)
    try {
      const r = await importApi.previewCsv(file)
      setCsvPreview(r.data)
    } catch {
      setMessage({ type: 'error', text: 'Не удалось распознать CSV' })
    }
  }

  async function handleCsvImport() {
    if (!csvFile) return
    setCsvImporting(true)
    try {
      const r = await importApi.importCsv(csvFile)
      setCsvResult(r.data)
      setCsvPreview(null)
      setCsvFile(null)
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary'] })
      setMessage({ type: 'success', text: `Импортировано ${r.data.imported} операций` })
    } catch {
      setMessage({ type: 'error', text: 'Ошибка при импорте' })
    } finally {
      setCsvImporting(false)
    }
  }

  return (
    <div className="max-w-7xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Документы</h1>
        <p className="mt-1 text-sm text-zinc-500">Импорт и экспорт данных</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} className="text-lg" /> {message.text}
        </div>
      )}

      {/* CSV Import */}
      <div className="rounded-2xl bg-surface-container-low p-4 ring-1 ring-white/[0.05] sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="upload_file" className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Импорт транзакций из CSV</h3>
            <p className="text-[10px] text-on-surface-variant">Поддерживаются форматы: банковские выписки, произвольный CSV</p>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleCsvPreview(e.target.files[0]) }} />

        {!csvPreview && !csvResult && (
          <div
            className="border-2 border-dashed border-outline-variant/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleCsvPreview(e.dataTransfer.files[0]) }}
          >
            <Icon name="cloud_upload" className="text-4xl text-on-surface-variant/30 mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">Перетащите CSV файл сюда или нажмите для выбора</p>
            <p className="text-[10px] text-on-surface-variant/60 mt-1">Колонки: дата, тип, сумма, описание, категория</p>
          </div>
        )}

        {csvPreview && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-on-surface">
                <span className="font-bold">{csvPreview.total_parsed}</span> операций распознано
                {csvPreview.errors?.length > 0 && (
                  <span className="text-error ml-2">({csvPreview.errors.length} ошибок)</span>
                )}
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-2">
                <button type="button" className="btn-ghost min-h-11 w-full sm:w-auto" onClick={() => { setCsvPreview(null); setCsvFile(null) }}>Отмена</button>
                <button type="button" className="btn-primary min-h-11 w-full sm:w-auto" disabled={csvImporting || csvPreview.total_parsed === 0} onClick={handleCsvImport}>
                  <Icon name="file_download" className="text-lg" />
                  {csvImporting ? 'Импортируем...' : `Импортировать ${csvPreview.total_parsed}`}
                </button>
              </div>
            </div>

            <div className="text-[10px] text-on-surface-variant flex gap-3 flex-wrap">
              <span>Колонки: {csvPreview.columns?.join(', ')}</span>
            </div>

            {csvPreview.preview?.length > 0 && (
              <div className="overflow-x-auto max-h-64 rounded-lg border border-outline-variant/10">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-high/50 text-[10px] text-on-surface-variant uppercase tracking-wider">
                      <th className="px-3 py-2">Дата</th>
                      <th className="px-3 py-2">Тип</th>
                      <th className="px-3 py-2 text-right">Сумма</th>
                      <th className="px-3 py-2">Описание</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {csvPreview.preview.slice(0, 20).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-container-high/30">
                        <td className="px-3 py-2 text-on-surface">{row.transaction_date}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            row.type === 'income' ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
                          }`}>{row.type}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-on-surface">{Number(row.amount).toFixed(2)}</td>
                        <td className="px-3 py-2 text-on-surface-variant truncate max-w-[200px]">{row.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {csvResult && (
          <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-secondary font-bold text-sm mb-2">
              <Icon name="check_circle" className="text-lg" /> Импорт завершён
            </div>
            <p className="text-xs text-on-surface-variant">
              Импортировано: <span className="font-bold text-on-surface">{csvResult.imported}</span>
              {csvResult.errors?.length > 0 && <span className="text-error ml-2">Ошибок: {csvResult.errors.length}</span>}
            </p>
            <button className="btn-ghost mt-3 text-xs" onClick={() => { setCsvResult(null); setCsvFile(null) }}>
              Импортировать ещё
            </button>
          </div>
        )}
      </div>

      <h2 className="font-headline text-lg font-bold text-white sm:text-xl">Экспорт</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {docs.map(doc => (
          <div key={doc.loadKey} className="group rounded-2xl bg-surface-container-low p-4 ring-1 ring-white/[0.05] transition-colors hover:bg-surface-container sm:p-6">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-bright">
                  <Icon name={doc.icon} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-on-surface">{doc.title}</h3>
                  <p className="text-[10px] text-on-surface-variant">{doc.subtitle}</p>
                </div>
              </div>
              <span className="text-[9px] font-bold rounded-md border border-outline-variant/20 bg-surface-variant px-2 py-0.5 text-on-surface-variant">{doc.format}</span>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 [&_.input]:min-h-11 [&_.input]:rounded-xl">{doc.fields}</div>
            <button type="button" className="btn-primary min-h-12 w-full" onClick={doc.action} disabled={loading !== null}>
              <Icon name="file_download" className="text-lg" />
              {loading === doc.loadKey ? 'Скачиваем...' : 'Скачать'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="font-headline text-lg font-bold text-white sm:text-xl">Первичные документы</h2>
      <p className="text-xs text-zinc-500 max-w-3xl">
        Сценарий: счёт (invoice) → оплата (привяжите транзакцию позже в API / следующих спринтах) → акт или накладная с привязкой к счёту.
        Печать — PDF с реквизитами ИП/ООО из организации.
      </p>

      <div className="rounded-2xl bg-surface-container-low p-4 ring-1 ring-white/[0.05] sm:p-6">
        <h3 className="text-sm font-bold text-on-surface">Создать документ</h3>
        <p className="text-[10px] text-on-surface-variant mb-4">
          Нумерация СЧ/АКТ/ТН по году; автонумерация или свой номер. Для акта и накладной можно выбрать счёт-основание.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              className="rounded border-outline-variant"
              checked={useAutoNumber}
              onChange={(e) => setUseAutoNumber(e.target.checked)}
            />
            Автонумерация
          </label>
          {useAutoNumber && nextNumPreview?.suggested_number && (
            <span className="text-[11px] text-teal-300/90">Следующий: {nextNumPreview.suggested_number}</span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select className="input" value={docForm.doc_type} onChange={(e) => setDocForm({ ...docForm, doc_type: e.target.value, related_document_id: '' })}>
            <option value="invoice">Invoice (Счёт)</option>
            <option value="act">Act (Акт)</option>
            <option value="waybill">Waybill (Накладная)</option>
          </select>
          <input
            className="input"
            placeholder="Номер документа"
            disabled={useAutoNumber}
            value={docForm.doc_number}
            onChange={(e) => setDocForm({ ...docForm, doc_number: e.target.value })}
          />
          <select className="input" value={docForm.status} onChange={(e) => setDocForm({ ...docForm, status: e.target.value })}>
            <option value="draft">Черновик</option>
            <option value="issued">Выставлен</option>
            <option value="paid">Оплачен</option>
            <option value="cancelled">Отменён</option>
          </select>
          <input type="date" className="input" value={docForm.issue_date} onChange={(e) => setDocForm({ ...docForm, issue_date: e.target.value })} />
          <input type="date" className="input" value={docForm.due_date} onChange={(e) => setDocForm({ ...docForm, due_date: e.target.value })} />
          <input className="input" placeholder="BYN" value={docForm.currency} onChange={(e) => setDocForm({ ...docForm, currency: e.target.value.toUpperCase() })} />
          <input type="number" step="0.01" min="0" className="input" placeholder="Сумма" value={docForm.amount_total} onChange={(e) => setDocForm({ ...docForm, amount_total: e.target.value })} />
          <select
            className="input sm:col-span-2"
            value={docForm.counterparty_id}
            onChange={(e) => setDocForm({ ...docForm, counterparty_id: e.target.value })}
          >
            <option value="">Контрагент (необязательно)</option>
            {(Array.isArray(counterpartiesData) ? counterpartiesData : []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} (УНП {c.unp})
              </option>
            ))}
          </select>
          {(docForm.doc_type === 'act' || docForm.doc_type === 'waybill') && (
            <select
              className="input sm:col-span-3"
              value={docForm.related_document_id}
              onChange={(e) => setDocForm({ ...docForm, related_document_id: e.target.value })}
            >
              <option value="">Счёт-основание (invoice)</option>
              {invoiceOptions.map((inv: any) => (
                <option key={inv.id} value={inv.id}>
                  {inv.doc_number} от {inv.issue_date} — {Number(inv.amount_total).toFixed(2)} {inv.currency}
                </option>
              ))}
            </select>
          )}
          <input className="input sm:col-span-2" placeholder="Заголовок" value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} />
          <input className="input sm:col-span-3" placeholder="Описание" value={docForm.description} onChange={(e) => setDocForm({ ...docForm, description: e.target.value })} />
        </div>
        <button
          type="button"
          className="btn-primary mt-4 min-h-11"
          disabled={
            (!useAutoNumber && !docForm.doc_number.trim()) ||
            !docForm.amount_total ||
            createPrimaryDocMutation.isPending
          }
          onClick={() => createPrimaryDocMutation.mutate()}
        >
          <Icon name="add" className="text-lg" />
          {createPrimaryDocMutation.isPending ? 'Создаём...' : 'Создать документ'}
        </button>
      </div>

      <div className="rounded-2xl bg-surface-container-low p-4 ring-1 ring-white/[0.05] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-sm font-bold text-on-surface">Список документов</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select className="input" value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
              <option value="">Все типы</option>
              <option value="invoice">Invoice</option>
              <option value="act">Act</option>
              <option value="waybill">Waybill</option>
            </select>
            <select className="input" value={docStatusFilter} onChange={(e) => setDocStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="issued">Выставлен</option>
              <option value="paid">Оплачен</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>
        </div>

        {primaryDocsLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Загрузка документов...</p>
        ) : (primaryDocsData?.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Документов пока нет.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="bg-surface-container-high/50 text-[10px] uppercase tracking-wider text-on-surface-variant">
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Номер</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2 text-right">Сумма</th>
                  <th className="px-3 py-2">Валюта</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {primaryDocsData.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-surface-container-high/30">
                    <td className="px-3 py-2 text-on-surface">{doc.doc_type}</td>
                    <td className="px-3 py-2 text-on-surface">{doc.doc_number}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{doc.status}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{doc.issue_date}</td>
                    <td className="px-3 py-2 text-right font-bold text-on-surface">{Number(doc.amount_total || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{doc.currency}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1 !text-xs"
                          disabled={printPrimaryDocMutation.isPending}
                          onClick={() =>
                            printPrimaryDocMutation.mutate({
                              id: doc.id,
                              doc_number: doc.doc_number,
                              doc_type: doc.doc_type,
                            })
                          }
                        >
                          <Icon name="print" className="text-sm" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1 !text-xs text-error"
                          disabled={deletePrimaryDocMutation.isPending}
                          onClick={() => {
                            if (confirm('Удалить документ?')) deletePrimaryDocMutation.mutate(doc.id)
                          }}
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      </div>
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
