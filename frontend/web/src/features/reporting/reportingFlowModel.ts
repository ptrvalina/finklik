/**
 * UI-only guided reporting flow (no backend).
 * Шаги синхронизированы с данными reporting/calm/overview.
 */

export type FlowStepId = 'review' | 'fix' | 'validate' | 'generate' | 'submit'

export type StepStatus = 'locked' | 'active' | 'completed'

export interface ReportingFlowStep {
  id: FlowStepId
  title: string
  shortLabel: string
  subtitle: string
  status: StepStatus
  issues?: string[]
}

/** Порог готовности: ниже — нельзя перейти к проверке AI из шага «Исправления». */
export const READINESS_THRESHOLD = 80

export const FLOW_STEP_META: {
  id: FlowStepId
  title: string
  /** Короткая подпись в rail (мобильный). */
  shortLabel: string
  /** Подзаголовок шага в панели гида. */
  subtitle: string
}[] = [
  {
    id: 'review',
    title: 'Сводка периода',
    shortLabel: 'Сводка',
    subtitle: 'Готовность, сроки и обязательства за отчётный месяц',
  },
  {
    id: 'fix',
    title: 'Данные периода',
    shortLabel: 'Данные',
    subtitle: 'Журнал, первичка и замечания до порога готовности',
  },
  {
    id: 'validate',
    title: 'Контроль AI',
    shortLabel: 'Контроль',
    subtitle: 'Пересчёт согласованности перед черновиком',
  },
  {
    id: 'generate',
    title: 'Черновик отчёта',
    shortLabel: 'Черновик',
    subtitle: 'Формирование пакета по органу (ИМНС, ФСЗН…)',
  },
  {
    id: 'submit',
    title: 'Подача',
    shortLabel: 'Подача',
    subtitle: 'Подтверждение и отправка в контур',
  },
]

const MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const

export type ReportingPeriodPhase =
  | 'accumulating'
  | 'closing'
  | 'deadline_pressure'
  | 'ready_for_draft'
  | 'monitoring'

export type ReportingPeriodNarrative = {
  periodKey: string
  periodLabel: string
  phase: ReportingPeriodPhase
  phaseLabel: string
  headline: string
  supporting: string
  suggestedStepId: FlowStepId
  milestones: { date: string; title: string; state?: string }[]
}

export function formatReportingPeriod(ref: Date = new Date()): { periodKey: string; periodLabel: string } {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  const name = MONTHS_RU[ref.getMonth()]
  const periodLabel = `${name.charAt(0).toUpperCase() + name.slice(1)} ${y}`
  return { periodKey: `${y}-${String(m).padStart(2, '0')}`, periodLabel }
}

function phaseCopy(phase: ReportingPeriodPhase): string {
  switch (phase) {
    case 'accumulating':
      return 'Накопление данных'
    case 'closing':
      return 'Закрытие периода'
    case 'deadline_pressure':
      return 'Сроки под давлением'
    case 'ready_for_draft':
      return 'Готов к черновику'
    case 'monitoring':
      return 'Контроль после отправки'
  }
}

/** Нарратив отчётного месяца из calm overview (без новых API). */
export function buildReportingPeriodNarrative(
  data: CalmOverviewLike | undefined,
  ref: Date = new Date(),
): ReportingPeriodNarrative {
  const { periodKey, periodLabel } = formatReportingPeriod(ref)
  const score = data?.readiness?.score ?? null
  const blockers = data?.readiness?.blockers?.length ?? 0
  const overdue =
    data?.timeline?.filter((t) => (t.state || '') === 'overdue').length ?? 0
  const needsAttention =
    data?.timeline?.filter((t) => (t.state || '') === 'needs_attention').length ?? 0
  const submittedThisPeriod =
    data?.timeline?.filter((t) => t.kind === 'submission' && (t.state || '') === 'submitted').length ?? 0
  const day = ref.getDate()

  let phase: ReportingPeriodPhase = 'accumulating'
  if (overdue > 0) phase = 'deadline_pressure'
  else if (score != null && score >= READINESS_THRESHOLD && blockers === 0) phase = 'ready_for_draft'
  else if (submittedThisPeriod > 0 && blockers === 0) phase = 'monitoring'
  else if (day >= 15 || blockers > 0 || needsAttention > 0) phase = 'closing'

  let suggestedStepId: FlowStepId = 'review'
  if (phase === 'ready_for_draft') suggestedStepId = 'validate'
  else if (blockers > 0 || (score != null && score < READINESS_THRESHOLD)) suggestedStepId = 'fix'
  else if (phase === 'monitoring') suggestedStepId = 'submit'

  const milestones = (data?.timeline ?? [])
    .filter((t) => t.date && String(t.date).startsWith(periodKey))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 6)
    .map((t) => ({ date: String(t.date), title: t.title, state: t.state }))

  let headline: string
  let supporting: string

  switch (phase) {
    case 'deadline_pressure':
      headline = `${periodLabel}: просроченные сроки — закройте календарь и обязательства`
      supporting =
        overdue > 0
          ? `В шкале ${overdue} просроченных событий. Сначала календарь и обязательства, затем журнал и сканы.`
          : 'Есть риски по срокам — проверьте обязательства в сводке.'
      break
    case 'ready_for_draft':
      headline = `${periodLabel}: данные сходятся — можно к контролю и черновику`
      supporting = 'Данные сходятся — можно к контролю и черновику в нужном органе.'
      break
    case 'monitoring':
      headline = `${periodLabel}: часть отчётов уже отправлена`
      supporting = 'Следите за статусами заявок и дозакройте оставшиеся органы при необходимости.'
      break
    case 'closing':
      headline =
        blockers > 0
          ? `${periodLabel}: закрытие периода — ${blockers} блокер(ов) готовности`
          : `${periodLabel}: идёт закрытие месяца`
      supporting =
        score != null && score < READINESS_THRESHOLD
          ? 'Исправьте журнал и OCR, затем контроль AI.'
          : 'Дозаполните журнал и первичку — система пересчитает готовность.'
      break
    default:
      headline = `${periodLabel}: накопление операций и первички`
      supporting =
        day < 15
          ? 'До середины месяца фокус на учёте и сканах — сроки появятся в сводке и календаре.'
          : 'Приближается закрытие — сверьте черновики журнала и очередь OCR.'
  }

  return {
    periodKey,
    periodLabel,
    phase,
    phaseLabel: phaseCopy(phase),
    headline,
    supporting,
    suggestedStepId,
    milestones,
  }
}

export function flowStepPanelTitle(stepId: FlowStepId, periodLabel: string): string {
  const meta = FLOW_STEP_META.find((m) => m.id === stepId)
  const n = FLOW_STEP_META.findIndex((m) => m.id === stepId) + 1
  return `Шаг ${n} · ${meta?.title ?? stepId} — ${periodLabel}`
}

/** Snippets from calm overview (loose typing — matches API). */
export type CalmOverviewLike = {
  readiness?: {
    score?: number | null
    confidence?: string
    blockers?: { code?: string; label: string }[]
  }
  consistency_issues?: { title: string; severity?: string }[]
  timeline?: { id?: string; kind?: string; title: string; date?: string; state?: string }[]
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
      if (overdue) out.push(`В календаре ${overdue} просроченных событий — их стоит закрыть в первую очередь`)
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
      if (n === 0) return ['Согласованность в порядке — можно переходить дальше']
      return [`Замечаний: ${n}`, ...(risk ? [`Из них важнее обратить внимание: ${risk}`] : [])]
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
      shortLabel: m.shortLabel,
      subtitle: m.subtitle,
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

export function deriveOwnerReportingStatus(
  data: CalmOverviewLike | undefined,
  fsState?: { reporting_status?: { status?: string } } | undefined,
): { label: string; hint?: string; tone: 'ok' | 'action' | 'warn' } {
  const rs = data?.financial_state?.reporting_status?.status ?? fsState?.reporting_status?.status ?? ''
  const blockers = data?.readiness?.blockers?.length ?? 0
  const issues = data?.consistency_issues?.length ?? 0

  if (rs === 'submitted') {
    return { label: 'Готова к подаче', hint: 'Отчёт отправлен', tone: 'ok' }
  }
  if (rs === 'ready' && blockers === 0 && issues === 0) {
    return { label: 'Готова к подаче', tone: 'ok' }
  }
  if (rs === 'ready_to_submit' || rs === 'signed') {
    return { label: 'Требуется подпись', hint: 'Подпишите отчёт перед отправкой', tone: 'action' }
  }
  return {
    label: 'Есть блокеры',
    hint: 'Исправьте замечания в журнале и документах',
    tone: 'warn',
  }
}

export function buildHomeReportingChecklist(data: CalmOverviewLike | undefined) {
  const blockers = data?.readiness?.blockers ?? []
  const score = data?.readiness?.score ?? 0
  const hasCode = (fragments: string[]) =>
    blockers.some((b) => {
      const hay = `${b.code ?? ''} ${b.label}`.toLowerCase()
      return fragments.some((f) => hay.includes(f))
    })
  const rs = data?.financial_state?.reporting_status?.status ?? ''
  const checksOk = (data?.consistency_issues?.length ?? 0) === 0 && score >= READINESS_THRESHOLD

  return [
    { label: 'Документы', done: !hasCode(['doc', 'ocr', 'первич', 'document', 'скан']) },
    { label: 'Журнал', done: !hasCode(['journal', 'журнал', 'операц', 'transaction']) },
    { label: 'Проверки', done: checksOk },
    { label: 'Подписать', done: ['ready_to_submit', 'submitted', 'signed'].includes(rs) },
    { label: 'Отправить', done: rs === 'submitted' },
  ]
}

export function readinessBlockedReason(data: CalmOverviewLike | undefined): string | null {
  const score = data?.readiness?.score
  if (score === null || score === undefined) return 'Ждём расчёт готовности…'
  if (score < READINESS_THRESHOLD) return 'Завершите шаги в чеклисте отчётности'
  return null
}

/** Короткая операционная подсказка ИИ по блокерам (не чат). */
export function suggestedFlowStepIndex(stepId: FlowStepId): number {
  const i = FLOW_STEP_META.findIndex((m) => m.id === stepId)
  return i >= 0 ? i : 0
}

export function operationalAiHint(data: CalmOverviewLike | undefined): string {
  if (!data?.readiness?.blockers?.length && !data?.consistency_issues?.length) {
    return data?.ai_summary || 'На этом снимке всё сходится — можно спокойно переходить к следующему шагу.'
  }
  const firstBlocker = data.readiness?.blockers?.[0]?.label
  const firstIssue = data.consistency_issues?.[0] as { title: string; severity?: string } | undefined
  if (firstBlocker) return `Начните с этого пункта: ${firstBlocker} — после этого картина станет яснее.`
  if (firstIssue) {
    return `Имеет смысл закрыть: ${firstIssue.title} — ${
      firstIssue.severity === 'risk' ? 'так спокойнее перед отчётом.' : 'до проверки будет удобнее.'
    }`
  }
  return data?.ai_summary || 'Посмотрите замечания ниже и обновите проверку, когда будет готово.'
}
