/** Замечания по операции из API (pipeline_status + validation_issues). */
export type JournalTxLike = {
  status?: string
  validation_issues?: string[] | null
  pipeline_status?: string | null
}

export function txValidationIssues(tx: JournalTxLike): string[] {
  const v = tx.validation_issues
  return Array.isArray(v) ? v.filter(Boolean) : []
}

export function txNeedsAttention(tx: JournalTxLike): boolean {
  return tx.status === 'draft' || txValidationIssues(tx).length > 0
}

export function txAttentionKind(tx: JournalTxLike): 'draft' | 'issue' | null {
  if (txValidationIssues(tx).length > 0) return 'issue'
  if (tx.status === 'draft') return 'draft'
  return null
}

export function txCanPost(tx: JournalTxLike): boolean {
  return tx.status === 'draft' && txValidationIssues(tx).length === 0
}

export function txAiConfidenceLabel(tx: { ai_category_confidence?: number | null }): string | null {
  const c = tx.ai_category_confidence
  if (c == null || Number.isNaN(Number(c))) return null
  const pct = Math.round(Number(c) * (Number(c) <= 1 ? 100 : 1))
  if (pct < 1) return null
  return `${pct}%`
}
