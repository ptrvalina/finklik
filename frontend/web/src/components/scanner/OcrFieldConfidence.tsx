/** Спокойная визуализация уверенности OCR по полю. */

export function confidencePercent(value: number | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  return Math.round(Math.min(100, Math.max(0, value)))
}

export function OcrConfidenceBadge({ value }: { value: number | undefined }) {
  const pct = confidencePercent(value)
  if (pct == null) return null
  const tone =
    pct >= 85 ? 'text-emerald-700 bg-emerald-500/10' : pct >= 65 ? 'text-amber-800 bg-amber-500/10' : 'text-amber-900 bg-amber-500/15'
  return (
    <span className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}>
      {pct}%
    </span>
  )
}

export function OcrFieldLabel({
  label,
  confidence,
  validation,
}: {
  label: string
  confidence?: number
  validation?: string
}) {
  const pct = confidencePercent(confidence)
  const needsReview = pct != null && pct < 75
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1">
      <span className="label !mb-0">{label}</span>
      <OcrConfidenceBadge value={confidence} />
      {needsReview && (
        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">проверьте</span>
      )}
      {validation && validation !== 'ok' && (
        <span className="text-[10px] text-on-surface-variant">{validation}</span>
      )}
    </div>
  )
}
