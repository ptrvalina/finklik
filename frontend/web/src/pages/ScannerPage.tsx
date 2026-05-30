import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportingCalmApi, scannerApi } from '../api/client'
import { formatApiDetail } from '../utils/apiError'
import { calmActionError } from '../i18n/messages.ru'
import { Link, useSearchParams } from 'react-router-dom'
import OcrReviewBanner from '../components/scanner/OcrReviewBanner'
import OcrCorrectionPanel from '../components/scanner/OcrCorrectionPanel'
import OcrPreviewOverlay from '../components/scanner/OcrPreviewOverlay'
import ReportingReadinessHero from '../features/reporting/ReportingReadinessHero'
import { orgQueryKey } from '../lib/queryKeys'
import { useOcrAutosave } from '../hooks/useOcrAutosave'
import {
  buildDraftFromScan,
  draftToCorrectionPayload,
  type OcrEditDraft,
  type OcrFieldKey,
} from '../lib/ocrCorrectionFields'
import type { FieldRegion } from '../components/scanner/OcrPreviewOverlay'
import { useOperational } from '../context/OperationalContext'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import { useAuthStore } from '../store/authStore'
import { loadScannerUiSession, saveScannerUiSession } from '../lib/scannerUiSession'
import { useMinWidthLg } from '../lib/useMinWidthLg'
import ScannerMobileWorkspace from '../components/scanner/ScannerMobileWorkspace'

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
type ExecutionSuggestions = {
  message?: string
  suggested_transaction?: ParsedData & { category?: string; debit_account?: string; credit_account?: string }
  suggested_category?: string
  create_work_pack?: boolean
  auto_link_transaction_id?: string | null
}

type ScanResult = {
  id: string; filename: string; doc_type: string; status: string; confidence: number
  ocr_text: string; parsed: ParsedData; created_at: string
  warnings?: string[]
  requires_review?: boolean
  field_confidence?: Record<string, number>
  field_validation?: Record<string, string>
  doc_type_confidence?: number
  vendor_hints?: Record<string, unknown>
  field_regions?: Record<string, FieldRegion>
  execution_suggestions?: ExecutionSuggestions
  linked_transaction_id?: string | null
}

type HistoryItem = {
  id: string; filename: string; doc_type: string; status: string; confidence: number
  parsed: ParsedData; transaction_id: string | null; created_at: string
}

const MAX_BATCH_FILES = 20

const DOC_ICONS: Record<string, { label: string; icon: string; color: string }> = {
  receipt: { label: 'Чек', icon: 'receipt', color: 'text-secondary' },
  ttn: { label: 'ТТН', icon: 'local_shipping', color: 'text-primary' },
  act: { label: 'Акт', icon: 'task', color: 'text-tertiary' },
  invoice: { label: 'Счёт', icon: 'request_quote', color: 'text-error' },
  payment_order: { label: 'Платёжное поручение', icon: 'payments', color: 'text-primary' },
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
  const [searchParams, setSearchParams] = useSearchParams()
  const orgId = useAuthStore((s) => s.user?.organization_id ?? '')
  const { recordOcrDoc, recordTransaction, setNextStep } = useOperational()
  const [autoAdvanceQueue, setAutoAdvanceQueue] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [editDraft, setEditDraft] = useState<OcrEditDraft | null>(null)
  const [correctedFields, setCorrectedFields] = useState<Set<string>>(new Set())
  const lastScanIdRef = useRef<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [txSaved, setTxSaved] = useState(false)
  const [createdTxId, setCreatedTxId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload')
  const [textInput, setTextInput] = useState('')
  const [textDocType, setTextDocType] = useState('')
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; name: string } | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [batchSummary, setBatchSummary] = useState<{ total: number; ok: number; failures: number } | null>(null)
  const [activeOcrField, setActiveOcrField] = useState<OcrFieldKey | null>(null)
  const [readinessNotice, setReadinessNotice] = useState<string | null>(null)
  const isLg = useMinWidthLg()

  useEffect(() => {
    if (!orgId) return
    const snap = loadScannerUiSession(orgId)
    setAutoAdvanceQueue(snap?.autoAdvanceQueue ?? true)
  }, [orgId])

  const applyScanPayload = useCallback(
    (data: ScanResult) => {
      setScanResult(data)
      setEditDraft(buildDraftFromScan(data))
      setCorrectedFields(new Set())
      setTxSaved(Boolean(data.linked_transaction_id))
      setCreatedTxId(data.linked_transaction_id ?? null)
      setAmountError(null)
      if (data.id) {
        recordOcrDoc(data.id, data.filename || 'Документ')
      }
    },
    [recordOcrDoc],
  )

  const { data: history = [] } = useQuery<HistoryItem[]>({
    queryKey: orgQueryKey('scanner-history'),
    queryFn: () => scannerApi.list({ limit: 20 }).then((r) => r.data),
  })
  const { data: reviewQueueData } = useQuery({
    queryKey: orgQueryKey('scanner-review-queue'),
    queryFn: () => scannerApi.reviewQueue(50).then((r) => r.data as { items: any[] }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => scannerApi.upload(file),
    onSuccess: (res) => {
      applyScanPayload(res.data)
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-history') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-review-queue') })
    },
  })

  const loadDocMutation = useMutation({
    mutationFn: (id: string) => scannerApi.getDocument(id).then((r) => r.data as ScanResult),
    onSuccess: (data) => {
      applyScanPayload(data)
      document.getElementById('scanner-result')?.scrollIntoView({ behavior: 'smooth' })
    },
  })

  useEffect(() => {
    const docId = searchParams.get('doc_id')?.trim()
    if (!docId || loadDocMutation.isPending) return
    if (scanResult?.id === docId) return
    if (lastScanIdRef.current === docId) return
    lastScanIdRef.current = docId
    loadDocMutation.mutate(docId)
  }, [searchParams, loadDocMutation, scanResult?.id])

  const openNextInReviewQueue = useCallback(
    (currentId?: string | null) => {
      const items = reviewQueueData?.items ?? []
      if (!items.length) return
      const idx = currentId ? items.findIndex((i: { id: string }) => i.id === currentId) : -1
      const next = idx >= 0 ? items[idx + 1] : items[0]
      if (next && next.id !== currentId) loadDocMutation.mutate(next.id)
    },
    [reviewQueueData, loadDocMutation],
  )

  const confirmMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof draftToCorrectionPayload> }) =>
      scannerApi.confirmTransaction(id, payload).then((r) => r.data),
    onSuccess: async (data: { transaction_id?: string }) => {
      setTxSaved(true)
      setAmountError(null)
      setCreatedTxId(data.transaction_id ?? null)
      setReadinessNotice(null)
      if (scanResult?.id) {
        setScanResult((prev) =>
          prev
            ? {
                ...prev,
                linked_transaction_id: data.transaction_id ?? prev.linked_transaction_id,
                requires_review: false,
              }
            : prev,
        )
      }
      void qc.invalidateQueries({ queryKey: orgQueryKey(['transactions']) })
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-history') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-review-queue') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('financial-state-bundle') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('reporting-calm-overview') })
      try {
        const ov = await qc.fetchQuery({
          queryKey: orgQueryKey('reporting-calm-overview'),
          queryFn: () => reportingCalmApi.overview().then((r) => r.data),
        })
        const score = (ov as { readiness?: { score?: number } })?.readiness?.score
        if (score != null) setReadinessNotice(`Готовность отчётности обновлена: ${score}%`)
      } catch {
        setReadinessNotice('Данные учёта обновлены — проверьте готовность в отчётности')
      }
      const docId = scanResult?.id
      const title = editDraft?.counterparty || scanResult?.filename || 'Документ'
      if (docId) recordOcrDoc(docId, title)
      if (data.transaction_id) {
        recordTransaction(data.transaction_id, title)
        setNextStep({
          verb: 'review',
          label: 'Проверить проводку в журнале',
          path: `/accounting/journal?tx_id=${encodeURIComponent(data.transaction_id)}`,
        })
        const next = new URLSearchParams(searchParams)
        next.delete('doc_id')
        setSearchParams(next, { replace: true })
      } else {
        setNextStep({ verb: 'continue', label: 'Следующий документ в очереди', path: '/scan' })
      }
      if (autoAdvanceQueue) {
        window.setTimeout(() => openNextInReviewQueue(docId), 400)
      }
    },
  })

  const { saving: autosaving } = useOcrAutosave({
    docId: scanResult?.id,
    draft: editDraft,
    correctedFields,
    category: scanResult?.execution_suggestions?.suggested_category as string | undefined,
    debitAccount: scanResult?.execution_suggestions?.suggested_transaction?.debit_account as string | undefined,
    creditAccount: scanResult?.execution_suggestions?.suggested_transaction?.credit_account as string | undefined,
    enabled: !txSaved,
    onSaved: (data) => {
      if (!data || typeof data !== 'object') return
      const d = data as ScanResult
      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              field_confidence: d.field_confidence,
              requires_review: d.requires_review,
              parsed: d.parsed ?? prev.parsed,
            }
          : prev,
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scannerApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-history') }),
  })

  const parseTextMutation = useMutation({
    mutationFn: () => scannerApi.parseText(textInput, textDocType || undefined),
    onSuccess: (res) => {
      applyScanPayload(res.data)
      setPreview(null)
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-history') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-review-queue') })
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
    setEditDraft(buildDraftFromScan(scanResult))
    setCorrectedFields(new Set())
  }, [scanResult])

  const handleFile = useCallback((file: File) => {
    setBatchError(null)
    setBatchSummary(null)
    setPreview(null)
    setScanResult(null)
    setTxSaved(false)
    setCreatedTxId(null)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
    uploadMutation.mutate(file)
  }, [uploadMutation])

  const processBatch = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).slice(0, MAX_BATCH_FILES)
      if (files.length === 0) return
      if (files.length === 1) {
        handleFile(files[0])
        return
      }
      setBatchError(null)
      setBatchSummary(null)
      setBatchProgress({ done: 0, total: files.length, name: files[0].name })
      let lastData: ScanResult | null = null
      let lastPreview: string | null = null
      let failures = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        setBatchProgress({ done: i, total: files.length, name: f.name })
        try {
          const res = await scannerApi.upload(f)
          lastData = res.data as ScanResult
          if (f.type.startsWith('image/')) {
            lastPreview = await new Promise<string | null>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => resolve(null)
              reader.readAsDataURL(f)
            })
          }
        } catch {
          failures += 1
        }
        setBatchProgress({ done: i + 1, total: files.length, name: f.name })
      }
      setBatchProgress(null)
      const ok = files.length - failures
      setBatchSummary({ total: files.length, ok, failures })
      if (lastData) {
        applyScanPayload(lastData)
        setPreview(lastPreview)
        document.getElementById('scanner-result')?.scrollIntoView({ behavior: 'smooth' })
      }
      if (failures > 0) {
        setBatchError(`${failures} из ${files.length} не распознаны — проверьте формат или повторите.`)
      }
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-history') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('scanner-review-queue') })
    },
    [applyScanPayload, handleFile, qc],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = e.dataTransfer.files
      if (!files?.length) return
      if (files.length > 1) void processBatch(files)
      else handleFile(files[0])
    },
    [handleFile, processBatch],
  )

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      if (files.length > 1) void processBatch(files)
      else handleFile(files[0])
      e.target.value = ''
    },
    [handleFile, processBatch],
  )

  function submitTxFromDraft() {
    if (!editDraft || !scanResult?.id) return
    const raw = editDraft.amount.replace(/\s/g, '').replace(',', '.')
    const amt = parseFloat(raw) || 0
    if (amt <= 0) {
      setAmountError('Укажите сумму больше 0')
      return
    }
    setAmountError(null)
    const payload = draftToCorrectionPayload(editDraft, [...correctedFields], {
      category: scanResult.execution_suggestions?.suggested_category as string | undefined,
      debit_account: scanResult.execution_suggestions?.suggested_transaction?.debit_account as string | undefined,
      credit_account: scanResult.execution_suggestions?.suggested_transaction?.credit_account as string | undefined,
    })
    confirmMutation.mutate({ id: scanResult.id, payload })
  }

  function markCorrected(fcKey: string) {
    setCorrectedFields((prev) => new Set(prev).add(fcKey))
  }

  function handleDraftChange(patch: Partial<OcrEditDraft>, _field: OcrFieldKey) {
    setEditDraft((d) => (d ? { ...d, ...patch } : d))
    setAmountError(null)
  }

  const reviewCount = reviewQueueData?.items?.length ?? 0
  const mobileReview = !isLg && !!scanResult && !!editDraft

  function dismissScan() {
    setScanResult(null)
    setEditDraft(null)
    setPreview(null)
    setTxSaved(false)
    setCreatedTxId(null)
    setActiveOcrField(null)
    lastScanIdRef.current = null
  }

  return (
    <>
      {mobileReview && scanResult && editDraft && (
        <ScannerMobileWorkspace
          scan={scanResult}
          docLabel={(DOC_ICONS[editDraft.docType || scanResult.doc_type] || DOC_ICONS.unknown).label}
          preview={preview}
          editDraft={editDraft}
          activeOcrField={activeOcrField}
          amountError={amountError}
          autosaving={autosaving}
          txSaved={txSaved}
          createdTxId={createdTxId}
          confirmPending={confirmMutation.isPending}
          reviewQueueCount={reviewQueueData?.items?.length ?? 0}
          onClose={dismissScan}
          onDraftChange={handleDraftChange}
          onMarkCorrected={markCorrected}
          onConfirm={submitTxFromDraft}
          onFieldFocus={setActiveOcrField}
          onNextInQueue={() => openNextInReviewQueue(scanResult.id)}
          nextPending={loadDocMutation.isPending}
        />
      )}

    <div className="fc-page-shell fc-page-shell-asymmetric scanner-page pb-20 lg:pb-8">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">В очереди</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface">{reviewCount}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">История</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface">{history.length}</p>
        </div>
        <div className="glass-card col-span-2 rounded-2xl p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Режим</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">
            {reviewCount > 0 ? 'Пакетная проверка OCR' : 'Загрузка и распознавание'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm" onClick={() => fileRef.current?.click()}>
          <Icon name="cloud_upload" className="text-lg" /> Загрузить
        </button>
        <Link to="/accounting/journal" className="btn-secondary text-sm">
          <Icon name="receipt_long" className="text-lg" /> Журнал
        </Link>
      </div>
      <FinancialStateHero compact className="mb-4 max-lg:hidden" />

      {batchSummary && batchSummary.total > 1 && (
        <div className="fc-surface-calm mb-4 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface">
            <span className="font-semibold">Пакет загружен:</span> {batchSummary.ok} из {batchSummary.total} распознаны
            {batchSummary.failures > 0 ? ` · ${batchSummary.failures} с ошибкой` : ''}.
            {reviewCount > 0 ? ` В очереди проверки: ${reviewCount}.` : ' Проверьте поля последнего документа.'}
          </p>
          {reviewCount > 0 && (
            <button
              type="button"
              className="btn-secondary min-h-9 text-xs"
              onClick={() => document.getElementById('scanner-review-queue')?.scrollIntoView({ behavior: 'smooth' })}
            >
              К очереди проверки
            </button>
          )}
        </div>
      )}

      {readinessNotice && (
        <div className="fc-surface-calm fc-surface-calm--ok mb-4 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-on-surface">{readinessNotice}</p>
          <Link to="/reports" className="btn-secondary min-h-9 text-xs">
            Отчётность
          </Link>
        </div>
      )}

      {reviewCount > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface">
            <span className="font-semibold">Режим очереди:</span>{' '}
            {autoAdvanceQueue
              ? 'после подтверждения откроется следующий документ.'
              : 'авто-переход выключен — переходите вручную.'}
          </p>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-on-surface">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-outline/60"
              checked={autoAdvanceQueue}
              onChange={(e) => {
                const v = e.target.checked
                setAutoAdvanceQueue(v)
                if (orgId) saveScannerUiSession(orgId, { v: 1, autoAdvanceQueue: v })
              }}
            />
            Авто-переход по очереди
          </label>
        </div>
      )}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Left: batch + history */}
        <div className="col-span-12 hidden space-y-4 lg:col-span-3 lg:block">
          {(reviewQueueData?.items?.length ?? 0) > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h4 className="text-sm font-bold text-on-surface">Очередь проверки</h4>
              <ul className="mt-3 space-y-2">
                {reviewQueueData!.items.slice(0, 5).map((item: { id: string; filename: string; confidence: number }) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-outline/35 px-3 py-2 text-left text-xs hover:border-primary/35"
                      disabled={loadDocMutation.isPending}
                      onClick={() => loadDocMutation.mutate(item.id)}
                    >
                      <span className="truncate font-medium">{item.filename}</span>
                      <span className="ml-2 shrink-0 text-amber-700">{item.confidence}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {history.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h4 className="font-bold font-headline text-on-surface">Недавние сканы</h4>
              <div className="mt-3 space-y-2">
                {history.slice(0, 5).map((item) => {
                  const t = DOC_ICONS[item.doc_type] || DOC_ICONS.unknown
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-surface-container-high"
                      onClick={() => loadDocMutation.mutate(item.id)}
                    >
                      <Icon name={t.icon} className={`text-lg ${t.color}`} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.filename}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Center: upload / preview */}
        <div className="col-span-12 lg:col-span-6">
          <div className="-mx-1 mb-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
            <div className="flex min-w-max gap-1 rounded-xl border border-outline/75 bg-surface-container-high p-1 shadow-soft sm:inline-flex sm:min-w-0">
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
            <motion.div
              layout
              className={`relative cursor-pointer overflow-hidden rounded-2xl ${dragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-[rgb(var(--color-canvas))]' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              animate={dragOver ? { scale: 1.008 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={onFileInput}
              />
              <div className={`fc-premium-surface flex h-[min(420px,55vh)] w-full min-h-[min(280px,52dvh)] flex-col items-center justify-center border-2 border-dashed transition-colors duration-300 max-lg:min-h-[min(360px,58dvh)] sm:h-[420px] ${
                dragOver ? 'border-emerald-400/60 bg-emerald-500/[0.08]' : 'border-primary/35 bg-[rgb(var(--color-surface)/0.35)] hover:border-primary/50 hover:bg-emerald-500/[0.06]'
              }`}>
                {uploadMutation.isPending || batchProgress ? (
                  <div className="space-y-6 px-6 text-center">
                    <div className="relative mx-auto h-16 w-16">
                      <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-400/40" />
                    </div>
                    <div>
                      <p className="font-headline text-sm font-semibold text-on-surface">
                        {batchProgress
                          ? `Пакет ${batchProgress.done} / ${batchProgress.total}`
                          : 'Распознаём документ'}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                        {batchProgress
                          ? batchProgress.name
                          : 'OCR · классификация · извлечение суммы и реквизитов'}
                      </p>
                    </div>
                    <div className="flex justify-center gap-1.5">
                      {['Скан', 'Текст', 'Поля'].map((step, i) => (
                        <span
                          key={step}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            i === 0 ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/[0.06] text-on-surface-variant'
                          }`}
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                      <Icon name="cloud_upload" className="text-primary text-4xl" />
                    </div>
                    <h3 className="text-xl font-bold font-headline text-on-surface mb-2">Перетащите файл или нажмите</h3>
                    <p className="text-on-surface-variant text-sm mb-8">PDF, PNG, JPG · до {MAX_BATCH_FILES} файлов · 25 МБ каждый</p>
                    <button type="button" className="btn-primary min-h-12 px-4" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
                      <Icon name="add" className="text-xl" /> Выбрать документ
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="rounded-3xl border border-outline/75 bg-surface-container-low p-4 shadow-soft sm:p-6">
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
                  {calmActionError('ocr', formatApiDetail((parseTextMutation.error as any)?.response?.data?.detail))}
                </div>
              )}
            </div>
          )}

          {(uploadMutation.isError || batchError) && (
            <div className="mt-4 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
              {batchError ||
                calmActionError('ocr', clientErrorText(uploadMutation.error) || formatApiDetail((uploadMutation.error as any)?.response?.data?.detail))}
            </div>
          )}

          {/* Scan result */}
          {scanResult && (() => {
            const displayDoc = editDraft?.docType || scanResult.doc_type
            const dmeta = DOC_ICONS[displayDoc] || DOC_ICONS.unknown
            return (
            <motion.div
              id="scanner-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={`fc-premium-surface mt-6 overflow-hidden shadow-soft ${mobileReview ? 'hidden lg:block' : ''}`}
            >
              <div className="flex flex-col gap-3 border-b border-outline-variant/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <Icon name={dmeta.icon} filled className={`text-2xl ${dmeta.color}`} />
                  <div>
                    <h3 className="font-bold text-on-surface">{dmeta.label} распознан</h3>
                    <p className="text-xs text-on-surface-variant">{scanResult.filename}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(scanResult.requires_review || scanResult.confidence < 75) && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                      Нужна проверка
                    </span>
                  )}
                  <span className={`text-sm font-bold ${scanResult.confidence >= 90 ? 'text-secondary' : scanResult.confidence >= 75 ? 'text-tertiary' : 'text-error'}`}>
                    {scanResult.confidence}%
                  </span>
                  <div className="w-20 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scanResult.confidence >= 90 ? 'bg-secondary' : scanResult.confidence >= 75 ? 'bg-tertiary' : 'bg-error'}`}
                      style={{ width: `${scanResult.confidence}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 lg:max-w-none">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full rounded-lg object-contain max-h-[min(520px,60vh)] bg-surface" />
                  ) : (
                    <div className="flex h-60 items-center justify-center rounded-lg bg-surface lg:h-80">
                      <Icon name="description" className="text-5xl text-on-surface-variant/20" />
                    </div>
                  )}
                  {scanResult.ocr_text && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs text-on-surface-variant hover:text-on-surface">Текст распознавания</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs text-on-surface-variant">{scanResult.ocr_text}</pre>
                    </details>
                  )}
              </div>
            </motion.div>
            )
          })()}
        </div>

        {/* Right: OCR results + readiness */}
        <div className="col-span-12 hidden space-y-4 lg:col-span-3 lg:block">
          <ReportingReadinessHero />
          {scanResult && editDraft && (
            <div className="glass-card space-y-4 rounded-2xl p-4">
              <OcrReviewBanner
                confidence={scanResult.confidence}
                fieldConfidence={scanResult.field_confidence}
                requiresReview={scanResult.requires_review}
              />
              <OcrCorrectionPanel
                draft={editDraft}
                fieldConfidence={scanResult.field_confidence}
                fieldValidation={scanResult.field_validation}
                docNumber={scanResult.parsed.doc_number}
                vendorHints={scanResult.vendor_hints}
                suggestedDebit={scanResult.execution_suggestions?.suggested_transaction?.debit_account as string | undefined}
                suggestedCredit={scanResult.execution_suggestions?.suggested_transaction?.credit_account as string | undefined}
                amountError={amountError}
                autosaving={autosaving}
                onChange={handleDraftChange}
                onMarkCorrected={markCorrected}
                onConfirm={submitTxFromDraft}
                confirmPending={confirmMutation.isPending}
                confirmed={txSaved}
                onFieldFocus={setActiveOcrField}
              />
              {txSaved && createdTxId && (
                <Link
                  to={`/accounting/journal?tx_id=${encodeURIComponent(createdTxId)}`}
                  className="btn-primary flex min-h-10 w-full justify-center text-sm"
                >
                  Подтвердить в журнале
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {(reviewQueueData?.items?.length ?? 0) > 0 && (
        <section id="scanner-review-queue" className="mt-8 lg:hidden">
          <h2 className="fc-section-label mb-3">Очередь проверки</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {reviewQueueData!.items.map((item: { id: string; filename: string; confidence: number; doc_type: string }) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-outline/35 bg-surface/90 px-4 py-3 text-left hover:border-primary/35"
                  disabled={loadDocMutation.isPending}
                  onClick={() => loadDocMutation.mutate(item.id)}
                >
                  <span className="min-w-0 truncate text-sm font-medium text-on-surface">{item.filename}</span>
                  <span className="ml-2 shrink-0 text-xs text-amber-700 dark:text-amber-200">{item.confidence}%</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="fc-stat-tile rounded-2xl border border-outline/40 bg-surface/80 px-4 py-3">
          <p className="font-headline text-xl font-bold tabular-nums text-on-surface">{history.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Сканов в истории</p>
        </div>
        <div className="fc-stat-tile rounded-2xl border border-outline/40 bg-surface/80 px-4 py-3">
          <p className="font-headline text-xl font-bold tabular-nums text-on-surface">{reviewQueueData?.items?.length ?? 0}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Ждут проверки</p>
        </div>
      </div>
    </div>
    </>
  )
}
