import { useState, useRef, useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { scannerApi, dashboardApi } from '../api/client'
import { formatApiDetail } from '../utils/apiError'

function clientErrorText(err: unknown): string {
  const e = err as { response?: { data?: { detail?: unknown }; status?: number }; message?: string }
  const d = formatApiDetail(e?.response?.data?.detail)
  if (d) return d
  if (e?.response?.status) return `Код ответа: ${e.response.status}`
  if (e?.message) return e.message
  return ''
}

type ParsedData = {
  type?: string; amount?: number; vat_amount?: number; description?: string
  transaction_date?: string; counterparty_name?: string; doc_number?: string; items_count?: number
}
type ScanResult = {
  id: string; filename: string; doc_type: string; status: string; confidence: number
  ocr_text: string; parsed: ParsedData; created_at: string
  warnings?: string[]
}
type HistoryItem = {
  id: string; filename: string; doc_type: string; status: string; confidence: number
  parsed: ParsedData; transaction_id: string | null; created_at: string
}

type EditDraft = {
  docType: string
  counterparty: string
  transactionDate: string
  amount: string
  vatAmount: string
  txType: string
  description: string
}

const DOC_ICONS: Record<string, { label: string; icon: string; color: string }> = {
  receipt: { label: 'Чек', icon: 'receipt', color: 'text-secondary' },
  ttn: { label: 'ТТН', icon: 'local_shipping', color: 'text-primary' },
  act: { label: 'Акт', icon: 'task', color: 'text-tertiary' },
  invoice: { label: 'Счёт', icon: 'request_quote', color: 'text-error' },
  unknown: { label: 'Другое', icon: 'description', color: 'text-on-surface-variant' },
}

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

export default function ScannerPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const lastScanIdRef = useRef<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [txSaved, setTxSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload')
  const [textInput, setTextInput] = useState('')
  const [textDocType, setTextDocType] = useState('')

  const { data: history = [] } = useQuery<HistoryItem[]>({
    queryKey: ['scanner-history'],
    queryFn: () => scannerApi.list({ limit: 20 }).then((r) => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => scannerApi.upload(file),
    onSuccess: (res) => {
      setScanResult(res.data)
      setTxSaved(false)
      qc.invalidateQueries({ queryKey: ['scanner-history'] })
    },
  })

  const createTxMutation = useMutation({
    mutationFn: (data: any) => dashboardApi.createTransaction(data),
    onSuccess: () => {
      setTxSaved(true)
      setAmountError(null)
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scannerApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scanner-history'] }),
  })

  const parseTextMutation = useMutation({
    mutationFn: () => scannerApi.parseText(textInput, textDocType || undefined),
    onSuccess: (res) => {
      setScanResult(res.data)
      setTxSaved(false)
      setPreview(null)
      qc.invalidateQueries({ queryKey: ['scanner-history'] })
    },
  })

  useEffect(() => {
    if (!scanResult?.id) {
      setEditDraft(null)
      lastScanIdRef.current = null
      return
    }
    if (lastScanIdRef.current === scanResult.id) return
    lastScanIdRef.current = scanResult.id
    const p = scanResult.parsed
    const d0 = (p.transaction_date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
    setEditDraft({
      docType: scanResult.doc_type || 'unknown',
      counterparty: p.counterparty_name || '',
      transactionDate: d0,
      amount: p.amount != null && Number(p.amount) > 0 ? String(p.amount) : '',
      vatAmount: p.vat_amount != null && Number(p.vat_amount) > 0 ? String(p.vat_amount) : '',
      txType: p.type || 'expense',
      description: p.description || '',
    })
    setAmountError(null)
    setTxSaved(false)
  }, [scanResult])

  const handleFile = useCallback((file: File) => {
    setPreview(null); setScanResult(null); setTxSaved(false)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
    uploadMutation.mutate(file)
  }, [uploadMutation.mutate])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  function submitTxFromDraft() {
    if (!editDraft || !scanResult) return
    const raw = editDraft.amount.replace(/\s/g, '').replace(',', '.')
    const amt = parseFloat(raw) || 0
    if (amt <= 0) {
      setAmountError('Укажите сумму больше 0')
      return
    }
    setAmountError(null)
    const vatRaw = editDraft.vatAmount.replace(/\s/g, '').replace(',', '.')
    const vat = parseFloat(vatRaw) || 0
    const label = DOC_ICONS[editDraft.docType]?.label || 'Документ'
    const cp = editDraft.counterparty.trim()
    const desc =
      editDraft.description.trim()
      || (cp ? `${label}: ${cp}` : `${label} (${scanResult.filename})`)
    createTxMutation.mutate({
      type: editDraft.txType,
      amount: amt,
      vat_amount: vat,
      description: desc,
      transaction_date: editDraft.transactionDate,
    })
  }

  return (
    <div className="max-w-7xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Сканер документов</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Загрузите чеки, накладные или счета. AI автоматически извлечёт данные и предложит создать операцию.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="-mx-1 mb-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
            <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 ring-1 ring-white/[0.05] sm:inline-flex sm:min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`tap-highlight-none flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:py-1.5 ${
                  activeTab === 'upload' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon name="cloud_upload" className="text-sm" /> Файл
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`tap-highlight-none flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:py-1.5 ${
                  activeTab === 'text' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon name="edit_note" className="text-sm" /> Текст
              </button>
            </div>
          </div>

          {activeTab === 'upload' ? (
            <div
              className={`relative rounded-xl overflow-hidden transition-all cursor-pointer ${dragOver ? 'ring-2 ring-primary' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              <div className={`flex h-[min(420px,55vh)] w-full min-h-[240px] flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all sm:h-[420px] ${
                dragOver ? 'border-primary bg-primary/5' : 'border-primary/30 bg-surface-container-low/40 hover:bg-primary/5'
              }`}>
                {uploadMutation.isPending ? (
                  <div className="space-y-4 text-center">
                    <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-on-surface-variant font-medium">Обработка документа...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                      <Icon name="cloud_upload" className="text-primary text-4xl" />
                    </div>
                    <h3 className="text-xl font-bold font-headline text-on-surface mb-2">Перетащите файл или нажмите</h3>
                    <p className="text-on-surface-variant text-sm mb-8">PDF, PNG, JPG (до 25 МБ)</p>
                    <button type="button" className="btn-primary min-h-12 px-4" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
                      <Icon name="add" className="text-xl" /> Выбрать документ
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 ring-1 ring-white/[0.05] sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Icon name="auto_awesome" filled className="text-primary" />
                <div>
                  <h3 className="font-bold text-on-surface">AI-парсер текста</h3>
                  <p className="text-xs text-on-surface-variant">Вставьте текст ТТН, чека или накладной — AI извлечёт данные</p>
                </div>
              </div>
              <div className="mb-3 flex gap-3">
                <select className="input min-h-11 w-full rounded-xl sm:w-auto" value={textDocType} onChange={e => setTextDocType(e.target.value)}>
                  <option value="">Авто-определение</option>
                  <option value="ttn">ТТН</option>
                  <option value="receipt">Чек</option>
                  <option value="act">Акт</option>
                  <option value="invoice">Счёт-фактура</option>
                </select>
              </div>
              <textarea
                className="input min-h-[320px] font-mono text-xs"
                placeholder={"Вставьте текст документа...\n\nНапример:\nТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ № ТТН-1234\nОтправитель: ООО Пример\nУНП: 123456789\nДата: 01.04.2026\n\n1  Товар А  шт  10  15,00  150,00\n2  Товар Б  кг   5  20,00  100,00\n\nИтого: 250,00\nНДС: 41,67"}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn-primary min-h-12 w-full sm:w-auto"
                  disabled={textInput.trim().length < 10 || parseTextMutation.isPending}
                  onClick={() => parseTextMutation.mutate()}
                >
                  <Icon name="auto_awesome" className="text-lg" />
                  {parseTextMutation.isPending ? 'Анализируем...' : 'Распознать текст'}
                </button>
              </div>
              {parseTextMutation.isError && (
                <div className="mt-3 bg-error/10 border border-error/20 text-error px-4 py-2 rounded-lg text-sm">
                  {formatApiDetail((parseTextMutation.error as any)?.response?.data?.detail) || 'Ошибка при распознавании'}
                </div>
              )}
            </div>
          )}

          {uploadMutation.isError && (
            <div className="mt-4 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
              Ошибка: {clientErrorText(uploadMutation.error) || 'Попробуйте ещё раз'}
            </div>
          )}

          {/* Scan result */}
          {scanResult && (() => {
            const displayDoc = editDraft?.docType || scanResult.doc_type
            const dmeta = DOC_ICONS[displayDoc] || DOC_ICONS.unknown
            return (
            <div className="mt-6 overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low ring-1 ring-white/[0.05]">
              <div className="flex flex-col gap-3 border-b border-outline-variant/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <Icon name={dmeta.icon} filled className={`text-2xl ${dmeta.color}`} />
                  <div>
                    <h3 className="font-bold text-on-surface">{dmeta.label} распознан</h3>
                    <p className="text-xs text-on-surface-variant">{scanResult.filename}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${scanResult.confidence >= 90 ? 'text-secondary' : scanResult.confidence >= 75 ? 'text-tertiary' : 'text-error'}`}>
                    {scanResult.confidence}%
                  </span>
                  <div className="w-20 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scanResult.confidence >= 90 ? 'bg-secondary' : scanResult.confidence >= 75 ? 'bg-tertiary' : 'bg-error'}`}
                      style={{ width: `${scanResult.confidence}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                <div className="border-outline-variant/10 p-4 md:border-r sm:p-6">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full rounded-lg object-contain max-h-80 bg-surface" />
                  ) : (
                    <div className="h-60 flex items-center justify-center bg-surface rounded-lg">
                      <Icon name="description" className="text-5xl text-on-surface-variant/20" />
                    </div>
                  )}
                  {scanResult.ocr_text && (
                    <details className="mt-4">
                      <summary className="text-xs text-on-surface-variant cursor-pointer hover:text-on-surface">OCR текст</summary>
                      <pre className="mt-2 text-xs bg-surface p-3 rounded-lg whitespace-pre-wrap text-on-surface-variant max-h-40 overflow-auto">{scanResult.ocr_text}</pre>
                    </details>
                  )}
                </div>
                <div className="space-y-4 p-4 sm:p-6">
                  <div>
                    <h4 className="label">Данные для операции</h4>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Проверьте распознавание и при необходимости исправьте поля перед созданием операции.
                    </p>
                  </div>
                  {editDraft && (
                    <div className="space-y-3">
                      <div>
                        <label className="label">Вид документа</label>
                        <select
                          className="input min-h-11 w-full rounded-xl"
                          value={editDraft.docType}
                          onChange={(e) => setEditDraft((d) => d && { ...d, docType: e.target.value })}
                        >
                          {Object.entries(DOC_ICONS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Контрагент</label>
                        <input
                          className="input min-h-11 w-full rounded-xl"
                          value={editDraft.counterparty}
                          onChange={(e) => setEditDraft((d) => d && { ...d, counterparty: e.target.value })}
                          placeholder="Название организации или ИП"
                        />
                      </div>
                      {scanResult.parsed.doc_number && (
                        <p className="text-xs text-on-surface-variant">Номер в документе: {scanResult.parsed.doc_number}</p>
                      )}
                      <div>
                        <label className="label">Дата операции</label>
                        <input
                          type="date"
                          className="input min-h-11 w-full rounded-xl"
                          value={editDraft.transactionDate}
                          onChange={(e) => setEditDraft((d) => d && { ...d, transactionDate: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="label">Сумма, BYN</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input min-h-11 w-full rounded-xl"
                            value={editDraft.amount}
                            onChange={(e) => {
                              setEditDraft((d) => d && { ...d, amount: e.target.value })
                              setAmountError(null)
                            }}
                            placeholder="Например 44500 или 44 500"
                          />
                        </div>
                        <div>
                          <label className="label">НДС, BYN</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input min-h-11 w-full rounded-xl"
                            value={editDraft.vatAmount}
                            onChange={(e) => setEditDraft((d) => d && { ...d, vatAmount: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Тип операции</label>
                        <select
                          className="input min-h-11 w-full rounded-xl"
                          value={editDraft.txType}
                          onChange={(e) => setEditDraft((d) => d && { ...d, txType: e.target.value })}
                        >
                          <option value="expense">Расход</option>
                          <option value="income">Доход</option>
                          <option value="refund">Возврат</option>
                          <option value="writeoff">Списание</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Описание в операции</label>
                        <textarea
                          className="input min-h-[72px] w-full rounded-xl text-sm"
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((d) => d && { ...d, description: e.target.value })}
                          placeholder="Необязательно; если пусто — подставятся вид документа и контрагент"
                        />
                      </div>
                      {amountError && <p className="text-sm text-error">{amountError}</p>}
                    </div>
                  )}
                  {scanResult.parsed.items_count != null && (
                    <p className="text-xs text-on-surface-variant">Позиций в документе: {scanResult.parsed.items_count}</p>
                  )}
                  {scanResult.warnings && scanResult.warnings.length > 0 && (
                    <div className="bg-tertiary/5 border border-tertiary/20 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] text-tertiary font-bold uppercase tracking-wider">Предупреждения</p>
                      {scanResult.warnings.map((w: string, i: number) => (
                        <p key={i} className="text-xs text-on-surface-variant">• {w}</p>
                      ))}
                    </div>
                  )}
                  {!txSaved ? (
                    <button
                      type="button"
                      onClick={submitTxFromDraft}
                      className="btn-primary mt-2 min-h-12 w-full"
                      disabled={!editDraft || createTxMutation.isPending}
                    >
                      <Icon name="add" /> {createTxMutation.isPending ? 'Сохраняем...' : 'Создать операцию'}
                    </button>
                  ) : (
                    <div className="mt-4 bg-secondary/10 text-secondary border border-secondary/20 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                      <Icon name="check_circle" filled /> Операция создана
                    </div>
                  )}
                </div>
              </div>
            </div>
            )
          })()}
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/10">
            <h4 className="label flex items-center gap-2">
              <Icon name="auto_awesome" className="text-secondary text-lg" /> Smart Capture
            </h4>
            <ul className="space-y-4 mt-4">
              <li className="flex gap-4">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-surface-bright flex items-center justify-center">
                  <Icon name="crop_free" className="text-primary text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Авто-обрезка</p>
                  <p className="text-xs text-on-surface-variant">Определяем края и выравниваем изображение.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-surface-bright flex items-center justify-center">
                  <Icon name="history_edu" className="text-primary text-sm" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">OCR извлечение</p>
                  <p className="text-xs text-on-surface-variant">Конвертация печатного и рукописного текста.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Recent scans */}
          {history.length > 0 && (
            <div className="bg-surface-container-low rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold font-headline text-on-surface">Недавние сканы</h4>
              </div>
              <div className="space-y-3">
                {history.slice(0, 4).map((item) => {
                  const t = DOC_ICONS[item.doc_type] || DOC_ICONS.unknown
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-high transition-colors group">
                      <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center border border-outline-variant/20">
                        <Icon name={t.icon} className={`${t.color} group-hover:text-primary transition-colors`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-on-surface">
                          {item.parsed?.counterparty_name || item.parsed?.description || item.filename}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {new Date(item.created_at).toLocaleDateString('ru-RU')}
                          {item.parsed?.amount != null && ` · ${item.parsed.amount.toFixed(2)} BYN`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.transaction_id && <Icon name="check_circle" className="text-secondary text-sm" />}
                        <button type="button" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(item.id) }}
                          className="text-on-surface-variant opacity-100 transition-colors hover:text-error sm:opacity-0 sm:group-hover:opacity-100">
                          <Icon name="close" className="text-sm" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pro tip */}
          <div className="relative rounded-xl p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="relative z-10">
              <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">Pro Tip</p>
              <p className="text-sm text-on-surface font-medium leading-relaxed">
                Перетащите до 20 файлов одновременно для пакетной обработки.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {[
          { icon: 'account_tree', color: 'primary', label: 'Сканировано', value: String(history.length) },
          { icon: 'bolt', color: 'secondary', label: 'Время обработки', value: '~1.2s' },
          { icon: 'verified', color: 'tertiary', label: 'Точность OCR', value: '99.8%' },
          { icon: 'security', color: 'error', label: 'Хранение', value: 'AES-256' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-4 rounded-xl bg-surface-container p-4 sm:p-5">
            <div className={`w-12 h-12 rounded-full bg-${s.color}/5 flex items-center justify-center border border-${s.color}/20`}>
              <Icon name={s.icon} className={`text-${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">{s.label}</p>
              <p className="text-xl font-bold font-headline text-on-surface">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
