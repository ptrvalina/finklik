/** Подсказка после OCR: сколько полей проверить и зачем. */

function countLowConfidence(fc: Record<string, number> | undefined): number {
  if (!fc) return 0
  return Object.values(fc).filter((v) => v != null && v < 75).length
}

export default function OcrReviewBanner({
  confidence,
  fieldConfidence,
  requiresReview,
  confirmed,
}: {
  confidence: number
  fieldConfidence?: Record<string, number>
  requiresReview?: boolean
  confirmed?: boolean
}) {
  if (confirmed) {
    return (
      <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-on-surface">
        <p className="font-semibold text-emerald-800 dark:text-emerald-200">Операция в журнале</p>
        <p className="mt-1 text-xs text-on-surface-variant">Документ проведён. Можно перейти к следующему в очереди.</p>
      </div>
    )
  }

  const low = countLowConfidence(fieldConfidence)
  const needs = requiresReview || confidence < 75 || low > 0
  if (!needs && confidence >= 90) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-3 text-sm text-on-surface">
        <span className="font-semibold text-emerald-800 dark:text-emerald-200">Высокая уверенность — </span>
        быстро проверьте сумму и нажмите «Подтвердить в журнал».
      </div>
    )
  }

  const fieldsHint = low > 0 ? `${low} ${low === 1 ? 'поле' : low < 5 ? 'поля' : 'полей'}` : 'сумму и контрагента'
  const quality =
    confidence >= 75 ? 'средняя уверенность распознавания' : 'низкая уверенность — проверьте подсвеченные поля'

  return (
    <div className="rounded-2xl border border-amber-400/35 bg-amber-500/[0.08] px-4 py-3 text-sm text-on-surface">
      <p className="font-semibold text-amber-900 dark:text-amber-100">
        Проверьте {fieldsHint} — около 20 секунд
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{quality}. Ctrl+Enter — подтверждение.</p>
    </div>
  )
}
