/**
 * UI-only guided reporting flow (no backend).
 * Шаги синхронизированы с данными reporting/calm/overview.
 */

export type FlowStepId = 'review' | 'fix' | 'validate' | 'generate' | 'submit'

export type StepStatus = 'locked' | 'active' | 'completed'

export interface ReportingFlowStep {
  id: FlowStepId
  title: string
  status: StepStatus
  issues?: string[]
}

/** Порог готовности: ниже — нельзя перейти к проверке AI из шага «Исправления». */
export const READINESS_THRESHOLD = 80

export const FLOW_STEP_META: { id: FlowStepId; title: string }[] = [
  { id: 'review', title: 'Обзор' },
  { id: 'fix', title: 'Исправления' },
  { id: 'validate', title: 'Проверка' },
  { id: 'generate', title: 'Черновик' },
  { id: 'submit', title: 'Отправка' },
]

/** Snippets from calm overview (loose typing — matches API). */
export type CalmOverviewLike = {
  readiness?: {
    score?: number | null
    confidence?: string
    blockers?: { code?: string; label: string }[]
  }
  consistency_issues?: { title: string; severity?: string }[]
  timeline?: { id?: string; title: string; date?: string; state?: string }[]
  obligations_preview?: { id: string; obligation_type: string; amount: string; due_date: string }[]
  ai_summary?: string | null
  /** Flow 6 — канонический снимок (тот же источник, что /operations/financial-state). */
  financial_state?: {
    risk_level?: string
    reporting_status?: { status?: string; readiness_score?: number }
    compliance_state?: { level?: string }
    document_completeness?: { score?: number }
    cashflow_state?: { level?: string }
  }
  state_predictions?: Array<{ id: string; horizon_days: number; message: string; severity?: string }>
}

export function deriveIssuesForStep(stepId: FlowStepId, data: CalmOverviewLike | undefined): string[] {
  if (!data) return []
  switch (stepId) {
    case 'review': {
      const out: string[] = []
      const obl = data.obligations_preview?.length ?? 0
      const tl = data.timeline?.length ?? 0
      if (obl) out.push(`Обязательств в фокусе: ${obl}`)
      if (tl) out.push(`Событий в шкале времени: ${tl}`)
      const overdue = data.timeline?.filter((t) => (t.state || '') === 'overdue').length ?? 0
      if (overdue) out.push(`Просрочено в календаре: ${overdue}`)
      return out
    }
    case 'fix': {
      const b = data.readiness?.blockers?.map((x) => x.label) ?? []
      const c = data.consistency_issues?.map((x) => x.title) ?? []
      return [...b, ...c].slice(0, 12)
    }
    case 'validate': {
      const n = data.consistency_issues?.length ?? 0
      const risk = data.consistency_issues?.filter((x) => x.severity === 'risk').length ?? 0
      if (n === 0) return ['Замечаний по согласованности не найдено']
      return [`Замечаний: ${n}`, ...(risk ? [`Риск: ${risk}`] : [])]
    }
    default:
      return []
  }
}

export function buildFlowSteps(activeIndex: number, data: CalmOverviewLike | undefined): ReportingFlowStep[] {
  return FLOW_STEP_META.map((m, i) => {
    let status: StepStatus = 'locked'
    if (i < activeIndex) status = 'completed'
    else if (i === activeIndex) status = 'active'
    const issues = deriveIssuesForStep(m.id, data)
    return {
      id: m.id,
      title: m.title,
      status,
      ...(issues.length ? { issues } : {}),
    }
  })
}

export function canLeaveFixStep(data: CalmOverviewLike | undefined): boolean {
  const score = data?.readiness?.score
  if (score === null || score === undefined) return false
  return score >= READINESS_THRESHOLD
}

export function readinessBlockedReason(data: CalmOverviewLike | undefined): string | null {
  const score = data?.readiness?.score
  if (score === null || score === undefined) return 'Ждём расчёт готовности…'
  if (score < READINESS_THRESHOLD) return `Готовность ${score}% — нужно ≥ ${READINESS_THRESHOLD}% для следующего шага`
  return null
}

/** Короткая операционная подсказка ИИ по блокерам (не чат). */
export function operationalAiHint(data: CalmOverviewLike | undefined): string {
  if (!data?.readiness?.blockers?.length && !data?.consistency_issues?.length) {
    return data?.ai_summary || 'Данные согласованы для текущего снимка — можно двигаться по шагам.'
  }
  const firstBlocker = data.readiness?.blockers?.[0]?.label
  const firstIssue = data.consistency_issues?.[0] as { title: string; severity?: string } | undefined
  if (firstBlocker) return `Сначала снимите блок: ${firstBlocker}.`
  if (firstIssue) {
    return `Устраните: ${firstIssue.title} — ${
      firstIssue.severity === 'risk' ? 'повышенный риск для отчёта.' : 'желательно до проверки.'
    }`
  }
  return data?.ai_summary || 'Проверьте замечания ниже и обновите проверку.'
}
