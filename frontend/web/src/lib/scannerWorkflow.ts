/** Фазы клиентского потока сканера: загрузка → проверка → журнал. */

export type ScannerWorkflowPhase = 'idle' | 'processing' | 'review' | 'confirmed' | 'linked'

export type ScannerStepId = 'upload' | 'recognize' | 'review' | 'journal'

export const SCANNER_STEPS: { id: ScannerStepId; label: string; icon: string }[] = [
  { id: 'upload', label: 'Загрузка', icon: 'cloud_upload' },
  { id: 'recognize', label: 'Распознавание', icon: 'document_scanner' },
  { id: 'review', label: 'Проверка', icon: 'fact_check' },
  { id: 'journal', label: 'Журнал', icon: 'menu_book' },
]

export function countLowConfidenceFields(fc: Record<string, number> | undefined): number {
  if (!fc) return 0
  return Object.values(fc).filter((v) => v != null && v < 75).length
}

export function resolveWorkflowPhase(input: {
  isProcessing: boolean
  hasScan: boolean
  txSaved: boolean
  linkedTransactionId?: string | null
  requiresReview?: boolean
  confidence?: number
  fieldConfidence?: Record<string, number>
}): ScannerWorkflowPhase {
  if (input.isProcessing) return 'processing'
  if (!input.hasScan) return 'idle'
  if (input.txSaved || input.linkedTransactionId) {
    return input.linkedTransactionId && !input.txSaved ? 'linked' : 'confirmed'
  }
  const low = countLowConfidenceFields(input.fieldConfidence)
  if (input.requiresReview || (input.confidence ?? 0) < 75 || low > 0) return 'review'
  return 'review'
}

export function activeStepIndex(phase: ScannerWorkflowPhase): number {
  switch (phase) {
    case 'idle':
      return 0
    case 'processing':
      return 1
    case 'review':
      return 2
    case 'linked':
    case 'confirmed':
      return 3
    default:
      return 0
  }
}

export function queuePosition(
  currentId: string | null | undefined,
  items: { id: string }[],
): { index: number; total: number } | null {
  if (!currentId || !items.length) return null
  const index = items.findIndex((i) => i.id === currentId)
  if (index < 0) return { index: 0, total: items.length }
  return { index: index + 1, total: items.length }
}

export type ScannerFocusAction = {
  headline: string
  supporting?: string
  ctaLabel: string
  ctaTo?: string
  tone?: 'primary' | 'amber' | 'neutral'
}

export function resolveScannerFocus(input: {
  phase: ScannerWorkflowPhase
  reviewCount: number
  queuePos: { index: number; total: number } | null
  lowFields: number
  createdTxId?: string | null
  onUpload?: () => void
}): ScannerFocusAction | null {
  const { phase, reviewCount, queuePos, lowFields, createdTxId } = input

  if (phase === 'idle') {
    if (reviewCount > 0) {
      return {
        headline: `В очереди ${reviewCount} ${reviewCount === 1 ? 'документ' : reviewCount < 5 ? 'документа' : 'документов'} на проверку`,
        supporting: 'Продолжите с первого в очереди — поля уже распознаны, осталось подтвердить.',
        ctaLabel: 'Проверить очередь',
        tone: 'amber',
      }
    }
    return {
      headline: 'Загрузите чек, накладную или вставьте текст документа',
      supporting: 'Система извлечёт сумму, дату и контрагента — вы подтвердите операцию в журнале.',
      ctaLabel: 'Загрузить документ',
      tone: 'neutral',
    }
  }

  if (phase === 'processing') {
    return {
      headline: 'Распознаём документ',
      supporting: 'OCR, классификация и извлечение реквизитов — обычно до 15 секунд.',
      ctaLabel: 'Подождите…',
      tone: 'neutral',
    }
  }

  if (phase === 'confirmed' && createdTxId) {
    return {
      headline: 'Операция проведена в журнал',
      supporting: queuePos
        ? `Осталось в очереди: ${Math.max(0, queuePos.total - queuePos.index)} из ${queuePos.total}.`
        : 'Проверьте проводку или загрузите следующий документ.',
      ctaLabel: 'Проверить в журнале',
      ctaTo: `/accounting/journal?tx_id=${encodeURIComponent(createdTxId)}`,
      tone: 'primary',
    }
  }

  if (phase === 'linked') {
    return {
      headline: 'Документ уже связан с операцией в журнале',
      supporting: 'Дубликат не создан — проверьте существующую проводку или загрузите другой файл.',
      ctaLabel: 'Открыть журнал',
      ctaTo: '/accounting/journal',
      tone: 'neutral',
    }
  }

  const fieldsHint =
    lowFields > 0
      ? `${lowFields} ${lowFields === 1 ? 'поле' : lowFields < 5 ? 'поля' : 'полей'}`
      : 'сумму и контрагента'

  return {
    headline: queuePos
      ? `Проверка ${queuePos.index} из ${queuePos.total}: уточните ${fieldsHint}`
      : `Проверьте ${fieldsHint} и подтвердите в журнал`,
    supporting: 'Подсвеченные поля требуют внимания. Ctrl+Enter — быстрое подтверждение.',
    ctaLabel: 'Подтвердить в журнал',
    tone: 'amber',
  }
}
