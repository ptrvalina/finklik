import OcrReviewBanner from './OcrReviewBanner'
import OcrCorrectionPanel from './OcrCorrectionPanel'
import OcrPreviewOverlay from './OcrPreviewOverlay'
import ScannerWorkflowStepper from './ScannerWorkflowStepper'
import ScannerExecutionHint from './ScannerExecutionHint'
import ScannerSuccessBurst from './ScannerSuccessBurst'
import { formatMoneyAmount } from '../../lib/formatMoney'
import type { OcrEditDraft, OcrFieldKey } from '../../lib/ocrCorrectionFields'
import type { FieldRegion } from './OcrPreviewOverlay'

type ScanSlice = {
  id: string
  filename: string
  doc_type: string
  confidence: number
  linked_transaction_id?: string | null
  requires_review?: boolean
  ocr_text?: string
  field_confidence?: Record<string, number>
  field_validation?: Record<string, string>
  field_regions?: Record<string, FieldRegion>
  vendor_hints?: Record<string, unknown>
  parsed: { doc_number?: string; items_count?: number }
  warnings?: string[]
  execution_suggestions?: {
    message?: string
    suggested_category?: string
    suggested_transaction?: { debit_account?: string; credit_account?: string }
  }
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

/** P9: полноэкранный режим проверки OCR на мобильных — без боковой колонки и с фиксированным действием. */
export default function ScannerMobileWorkspace({
  scan,
  docLabel,
  preview,
  editDraft,
  activeOcrField,
  amountError,
  autosaving,
  txSaved,
  createdTxId,
  confirmPending,
  reviewQueueCount,
  onClose,
  onDraftChange,
  onMarkCorrected,
  onConfirm,
  onFieldFocus,
  onNextInQueue,
  nextPending,
}: {
  scan: ScanSlice
  docLabel: string
  preview: string | null
  editDraft: OcrEditDraft
  activeOcrField: OcrFieldKey | null
  amountError: string | null
  autosaving: boolean
  txSaved: boolean
  createdTxId: string | null
  confirmPending: boolean
  reviewQueueCount: number
  onClose: () => void
  onDraftChange: (patch: Partial<OcrEditDraft>, field: OcrFieldKey) => void
  onMarkCorrected: (key: string) => void
  onConfirm: () => void
  onFieldFocus: (field: OcrFieldKey | null) => void
  onNextInQueue: () => void
  nextPending?: boolean
}) {
  const phase = txSaved ? 'confirmed' : scan.linked_transaction_id ? 'linked' : 'review'

  return (
    <div
      className="fc-scanner-mobile fixed inset-0 z-[90] flex flex-col bg-canvas lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Проверка документа"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-outline/40 bg-surface/95 px-3 py-2.5 backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface-container-high"
          onClick={onClose}
          aria-label="Назад к загрузке"
        >
          <Icon name="arrow_back" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-on-surface">{docLabel}</p>
          <p className="truncate text-[11px] text-on-surface-variant">{scan.filename}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
            scan.confidence >= 90
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
              : scan.confidence >= 75
                ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
                : 'bg-red-500/15 text-red-800 dark:text-red-200'
          }`}
        >
          {scan.confidence}%
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="border-b border-outline/30 px-3 py-2">
          <ScannerWorkflowStepper phase={phase} />
        </div>
        {preview ? (
          <div className="border-b border-outline/30 bg-surface-container-low/80 p-3">
            <OcrPreviewOverlay
              previewUrl={preview}
              fieldRegions={scan.field_regions}
              activeField={activeOcrField}
              onFieldClick={onFieldFocus}
            />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center border-b border-outline/30 bg-surface-container-low/50">
            <Icon name="description" className="text-5xl text-on-surface-variant/25" />
          </div>
        )}

        <div className="space-y-4 p-4">
          {txSaved && createdTxId ? (
            <ScannerSuccessBurst
              amountLabel={
                editDraft.amount != null && editDraft.amount !== ''
                  ? `${formatMoneyAmount(editDraft.amount)} BYN`
                  : undefined
              }
              counterparty={editDraft.counterparty || undefined}
              journalTo={`/accounting/journal?tx_id=${encodeURIComponent(createdTxId)}`}
              onScanAnother={onClose}
            />
          ) : null}
          <OcrReviewBanner
            confidence={scan.confidence}
            fieldConfidence={scan.field_confidence}
            requiresReview={scan.requires_review}
            confirmed={txSaved}
          />
          <ScannerExecutionHint
            message={scan.execution_suggestions?.message}
            category={scan.execution_suggestions?.suggested_category}
            debit={scan.execution_suggestions?.suggested_transaction?.debit_account}
            credit={scan.execution_suggestions?.suggested_transaction?.credit_account}
            warnings={scan.warnings}
          />
          <div>
            <h4 className="label">Поля документа</h4>
            <p className="mt-1 text-xs text-on-surface-variant">Свайп вниз — все поля. Подтверждение — внизу экрана.</p>
          </div>
          <OcrCorrectionPanel
            draft={editDraft}
            fieldConfidence={scan.field_confidence}
            fieldValidation={scan.field_validation}
            docNumber={scan.parsed.doc_number}
            vendorHints={scan.vendor_hints}
            suggestedDebit={scan.execution_suggestions?.suggested_transaction?.debit_account}
            suggestedCredit={scan.execution_suggestions?.suggested_transaction?.credit_account}
            amountError={amountError}
            autosaving={autosaving}
            onChange={onDraftChange}
            onMarkCorrected={onMarkCorrected}
            onConfirm={onConfirm}
            confirmPending={confirmPending}
            confirmed={txSaved}
            onFieldFocus={onFieldFocus}
            hidePrimaryButton
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-outline/40 bg-surface/95 p-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!txSaved ? (
          <button
            type="button"
            className="btn-primary min-h-12 w-full text-sm font-bold shadow-[0_10px_28px_-12px_rgba(0,88,190,0.55)]"
            disabled={confirmPending}
            onClick={onConfirm}
          >
            {confirmPending ? 'Сохраняем…' : 'Подтвердить и в журнал'}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            {reviewQueueCount > 1 && (
              <button
                type="button"
                className="btn-primary min-h-11 w-full text-sm"
                disabled={nextPending}
                onClick={onNextInQueue}
              >
                Следующий в очереди
              </button>
            )}
            <button type="button" className="btn-secondary min-h-11 w-full text-sm" onClick={onClose}>
              Загрузить другой документ
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
