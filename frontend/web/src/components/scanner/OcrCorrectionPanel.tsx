import { useCallback, useEffect, useRef } from 'react'
import { OcrFieldLabel, OcrConfidenceBadge } from './OcrFieldConfidence'
import { CurrencyFieldLabel } from '../ui/CurrencyFieldLabel'
import {
  fieldNeedsReview,
  firstLowConfidenceField,
  type OcrEditDraft,
  type OcrFieldKey,
  OCR_FIELD_ORDER,
} from '../../lib/ocrCorrectionFields'
import { verbLabel } from '../../lib/operationalVerbs'

const DOC_LABELS: Record<string, string> = {
  receipt: 'Чек',
  ttn: 'ТТН',
  act: 'Акт',
  invoice: 'Счёт',
  payment_order: 'Платёжное поручение',
  kudir: 'КУДиР',
  unknown: 'Другое',
}

function reviewInputClass(needsReview: boolean): string {
  return needsReview
    ? 'input min-h-11 w-full rounded-xl border-amber-400/50 bg-amber-500/10 ring-1 ring-amber-400/30'
    : 'input min-h-11 w-full rounded-xl'
}

export default function OcrCorrectionPanel({
  draft,
  fieldConfidence,
  fieldValidation,
  docNumber,
  vendorHints,
  suggestedDebit,
  suggestedCredit,
  amountError,
  autosaving,
  onChange,
  onMarkCorrected,
  onConfirm,
  confirmPending,
  confirmed,
  onFieldFocus,
  hidePrimaryButton,
}: {
  draft: OcrEditDraft
  fieldConfidence?: Record<string, number>
  fieldValidation?: Record<string, string>
  docNumber?: string | null
  vendorHints?: Record<string, unknown> | null
  suggestedDebit?: string | null
  suggestedCredit?: string | null
  amountError?: string | null
  autosaving?: boolean
  onChange: (patch: Partial<OcrEditDraft>, fieldKey: OcrFieldKey) => void
  onMarkCorrected: (fcKey: string) => void
  onConfirm: () => void
  confirmPending?: boolean
  confirmed?: boolean
  onFieldFocus?: (key: OcrFieldKey) => void
  hidePrimaryButton?: boolean
}) {
  const refs = useRef<Partial<Record<OcrFieldKey, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>>>({})

  const register = useCallback(
    (key: OcrFieldKey) => (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => {
      if (el) refs.current[key] = el
    },
    [],
  )

  useEffect(() => {
    const first = firstLowConfidenceField(fieldConfidence)
    const target = first ? refs.current[first] : refs.current.counterparty
    target?.focus()
  }, [fieldConfidence, draft.docType])

  function focusNext(current: OcrFieldKey) {
    const idx = OCR_FIELD_ORDER.indexOf(current)
    for (let i = idx + 1; i < OCR_FIELD_ORDER.length; i++) {
      const el = refs.current[OCR_FIELD_ORDER[i]]
      if (el) {
        el.focus()
        return
      }
    }
  }

  function focusPrev(current: OcrFieldKey) {
    const idx = OCR_FIELD_ORDER.indexOf(current)
    for (let i = idx - 1; i >= 0; i--) {
      const el = refs.current[OCR_FIELD_ORDER[i]]
      if (el) {
        el.focus()
        return
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, key: OcrFieldKey) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onConfirm()
      return
    }
    if (e.key === 'Tab' && !e.shiftKey && key !== 'description') {
      const idx = OCR_FIELD_ORDER.indexOf(key)
      const nextKey = OCR_FIELD_ORDER[idx + 1]
      if (nextKey) {
        e.preventDefault()
        focusNext(key)
      }
      return
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      focusPrev(key)
      return
    }
    if (e.key === 'Enter' && key !== 'description') {
      e.preventDefault()
      focusNext(key)
    }
  }

  const fc = fieldConfidence

  return (
    <div className="space-y-3">
      {vendorHints && Number(vendorHints.scan_count ?? 0) > 1 && (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-on-surface-variant">
          Контрагент знаком системе ({String(vendorHints.scan_count)} сканов)
          {vendorHints.default_category ? ` · категория: ${String(vendorHints.default_category)}` : ''}
        </p>
      )}
      {(suggestedDebit || suggestedCredit) && (
        <p className="rounded-xl border border-outline/30 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          Проводка: Дт <span className="font-mono font-semibold text-on-surface">{suggestedDebit || '—'}</span>
          {' · '}
          Кт <span className="font-mono font-semibold text-on-surface">{suggestedCredit || '—'}</span>
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">Tab между полями · Ctrl+Enter — в журнал</p>
        {autosaving && <span className="text-[10px] font-medium text-primary">Сохраняем…</span>}
      </div>

      <div>
        <label className="label">Вид документа</label>
        <select
          ref={register('docType')}
          className="input min-h-11 w-full rounded-xl"
          value={draft.docType}
          onChange={(e) => {
            onChange({ docType: e.target.value }, 'docType')
            onMarkCorrected('doc_type')
          }}
          onKeyDown={(e) => handleKeyDown(e, 'docType')}
        >
          {Object.entries(DOC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div>
        <OcrFieldLabel
          label="Контрагент"
          confidence={fc?.counterparty_name}
          validation={fieldValidation?.counterparty_name}
        />
        <input
          id="ocr-field-counterparty"
          ref={register('counterparty')}
          className={reviewInputClass(fieldNeedsReview(fc, 'counterparty'))}
          value={draft.counterparty}
          onChange={(e) => {
            onChange({ counterparty: e.target.value }, 'counterparty')
            onMarkCorrected('counterparty_name')
          }}
          onFocus={() => onFieldFocus?.('counterparty')}
          onKeyDown={(e) => handleKeyDown(e, 'counterparty')}
          placeholder="Название организации или ИП"
        />
      </div>

      {docNumber && <p className="text-xs text-on-surface-variant">Номер в документе: {docNumber}</p>}

      <div>
        <label className="label">
          Дата операции
          {fieldNeedsReview(fc, 'transactionDate') && (
            <span className="ml-2 text-[10px] font-normal text-amber-400">низкая уверенность</span>
          )}
        </label>
        <input
          id="ocr-field-transactionDate"
          ref={register('transactionDate')}
          type="date"
          className={reviewInputClass(fieldNeedsReview(fc, 'transactionDate'))}
          value={draft.transactionDate}
          onChange={(e) => {
            onChange({ transactionDate: e.target.value }, 'transactionDate')
            onMarkCorrected('transaction_date')
          }}
          onFocus={() => onFieldFocus?.('transactionDate')}
          onKeyDown={(e) => handleKeyDown(e, 'transactionDate')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="label !mb-0">
              <CurrencyFieldLabel>Сумма</CurrencyFieldLabel>
            </span>
            <OcrConfidenceBadge value={fc?.amount} />
            {fieldNeedsReview(fc, 'amount') && (
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">проверьте</span>
            )}
            {fieldValidation?.amount && fieldValidation.amount !== 'ok' && (
              <span className="text-[10px] text-on-surface-variant">{fieldValidation.amount}</span>
            )}
          </div>
          <input
            id="ocr-field-amount"
            ref={register('amount')}
            type="text"
            inputMode="decimal"
            className={reviewInputClass(fieldNeedsReview(fc, 'amount'))}
            value={draft.amount}
            onFocus={() => onFieldFocus?.('amount')}
            onChange={(e) => {
              onChange({ amount: e.target.value }, 'amount')
              onMarkCorrected('amount')
            }}
            onKeyDown={(e) => handleKeyDown(e, 'amount')}
            placeholder="44500"
          />
        </div>
        <div>
          <label className="label"><CurrencyFieldLabel>НДС</CurrencyFieldLabel></label>
          <input
            ref={register('vatAmount')}
            type="text"
            inputMode="decimal"
            className="input min-h-11 w-full rounded-xl"
            value={draft.vatAmount}
            onChange={(e) => {
              onChange({ vatAmount: e.target.value }, 'vatAmount')
              onMarkCorrected('vat_amount')
            }}
            onKeyDown={(e) => handleKeyDown(e, 'vatAmount')}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="label">Тип операции</label>
        <select
          ref={register('txType')}
          className="input min-h-11 w-full rounded-xl"
          value={draft.txType}
          onChange={(e) => {
            onChange({ txType: e.target.value }, 'txType')
            onMarkCorrected('type')
          }}
          onKeyDown={(e) => handleKeyDown(e, 'txType')}
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
          ref={register('description')}
          className="input min-h-[72px] w-full rounded-xl text-sm"
          value={draft.description}
          onChange={(e) => {
            onChange({ description: e.target.value }, 'description')
            onMarkCorrected('description')
          }}
          onKeyDown={(e) => handleKeyDown(e, 'description')}
          placeholder="Необязательно"
        />
      </div>

      {amountError && <p className="text-sm text-error">{amountError}</p>}

      {!hidePrimaryButton &&
        (!confirmed ? (
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary min-h-12 w-full rounded-xl"
            disabled={confirmPending}
          >
            {confirmPending ? 'Сохраняем…' : `${verbLabel('confirm')} в журнал`}
          </button>
        ) : (
          <p className="rounded-xl border border-secondary/25 bg-secondary/10 px-3 py-3 text-sm font-semibold text-secondary">
            Операция в журнале — документ связан
          </p>
        ))}
    </div>
  )
}
