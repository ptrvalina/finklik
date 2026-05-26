export type OrgRow = {
  organization_id: string
  organization_name: string
  unp: string
  is_pinned?: boolean
  readiness_score?: number | null
  open_inbox?: number
  pending_approvals?: number
  attention_issues?: number
  pending_ocr?: number
  needs_review?: number
  next_deadline?: {
    date: string
    title: string
    kind?: string
    state?: string
    days_until?: number
  } | null
  ai_summary?: string | null
}

export function workloadScore(row: OrgRow): number {
  return (
    (row.open_inbox ?? 0) +
    (row.pending_approvals ?? 0) * 2 +
    (row.attention_issues ?? 0) * 3 +
    (row.needs_review ?? 0) * 2 +
    (row.pending_ocr ?? 0)
  )
}

export function readinessLabel(score: number | null | undefined): {
  text: string
  tone: 'ok' | 'warn' | 'risk'
} {
  if (score == null) return { text: 'нет данных', tone: 'warn' }
  if (score >= 80) return { text: 'готов к сдаче', tone: 'ok' }
  if (score >= 55) return { text: 'нужна доработка', tone: 'warn' }
  return { text: 'блокеры', tone: 'risk' }
}
