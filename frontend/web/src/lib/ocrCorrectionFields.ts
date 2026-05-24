export type OcrEditDraft = {
  docType: string
  counterparty: string
  transactionDate: string
  amount: string
  vatAmount: string
  txType: string
  description: string
}

export const OCR_FIELD_ORDER = [
  'counterparty',
  'transactionDate',
  'amount',
  'vatAmount',
  'description',
  'txType',
  'docType',
] as const

export type OcrFieldKey = (typeof OCR_FIELD_ORDER)[number]

const FC_KEY: Record<OcrFieldKey, string> = {
  counterparty: 'counterparty_name',
  transactionDate: 'transaction_date',
  amount: 'amount',
  vatAmount: 'vat_amount',
  description: 'description',
  txType: 'type',
  docType: 'doc_type',
}

export function fieldNeedsReview(fc: Record<string, number> | undefined, key: OcrFieldKey): boolean {
  if (!fc) return false
  const v = fc[FC_KEY[key]]
  return v != null && v < 75
}

export function firstLowConfidenceField(fc: Record<string, number> | undefined): OcrFieldKey | null {
  for (const key of OCR_FIELD_ORDER) {
    if (fieldNeedsReview(fc, key)) return key
  }
  return null
}

export function draftToCorrectionPayload(
  draft: OcrEditDraft,
  correctedFields: string[],
  extras?: { category?: string; debit_account?: string; credit_account?: string },
) {
  return {
    doc_type: draft.docType,
    counterparty_name: draft.counterparty,
    transaction_date: draft.transactionDate,
    amount: draft.amount.replace(/\s/g, '').replace(',', '.'),
    vat_amount: draft.vatAmount.replace(/\s/g, '').replace(',', '.'),
    type: draft.txType,
    description: draft.description,
    corrected_fields: correctedFields,
    ...extras,
  }
}

export function buildDraftFromScan(
  scan: {
    doc_type: string
    parsed: Record<string, unknown>
    execution_suggestions?: { suggested_transaction?: Record<string, unknown> }
  },
): OcrEditDraft {
  const p = scan.parsed
  const sug = scan.execution_suggestions?.suggested_transaction
  const d0 = String(p.transaction_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  return {
    docType: scan.doc_type || 'unknown',
    counterparty: String(sug?.counterparty_name ?? p.counterparty_name ?? ''),
    transactionDate: String(sug?.transaction_date ?? d0).slice(0, 10),
    amount:
      sug?.amount != null && Number(sug.amount) > 0
        ? String(sug.amount)
        : p.amount != null && Number(p.amount) > 0
          ? String(p.amount)
          : '',
    vatAmount:
      sug?.vat_amount != null && Number(sug.vat_amount) > 0
        ? String(sug.vat_amount)
        : p.vat_amount != null && Number(p.vat_amount) > 0
          ? String(p.vat_amount)
          : '',
    txType: String(sug?.type ?? p.type ?? 'expense'),
    description: String(sug?.description ?? p.description ?? ''),
  }
}
