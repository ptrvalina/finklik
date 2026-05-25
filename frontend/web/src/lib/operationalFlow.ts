import type { OperationalSessionV1 } from './operationalSession'

export type FlowStepId = 'scan' | 'journal' | 'reporting'
export type FlowStepState = 'idle' | 'active' | 'done'

export type OperationalFlowStep = {
  id: FlowStepId
  title: string
  state: FlowStepState
  path: string
  hint?: string
}

/** Цепочка OCR → журнал → отчётность для правой панели контекста. */
export function buildOperationalFlow(session: OperationalSessionV1): {
  steps: OperationalFlowStep[]
  suggestedPath: string | null
} {
  const hasOcr = Boolean(session.lastOcrDoc)
  const hasTx = Boolean(session.lastTransaction)
  const hasReporting = Boolean(session.lastReportingBlocker)

  const scan: OperationalFlowStep = {
    id: 'scan',
    title: 'Скан',
    state: hasOcr ? 'done' : 'active',
    path: session.lastOcrDoc
      ? `/scan?doc_id=${encodeURIComponent(session.lastOcrDoc.id)}`
      : '/scan',
    hint: hasOcr ? session.lastOcrDoc!.title : 'Загрузить документ',
  }

  let journalState: FlowStepState = 'idle'
  if (hasTx) journalState = 'done'
  else if (hasOcr) journalState = 'active'

  const journal: OperationalFlowStep = {
    id: 'journal',
    title: 'Журнал',
    state: journalState,
    path: session.lastTransaction
      ? `/accounting/journal?tx_id=${encodeURIComponent(session.lastTransaction.id)}`
      : '/accounting/journal',
    hint: hasTx ? session.lastTransaction!.title : hasOcr ? 'Провести проводку' : undefined,
  }

  let reportingState: FlowStepState = 'idle'
  if (hasReporting) reportingState = 'done'
  else if (hasTx) reportingState = 'active'

  const reporting: OperationalFlowStep = {
    id: 'reporting',
    title: 'Отчётность',
    state: reportingState,
    path: session.lastReportingBlocker?.path ?? '/reports',
    hint: session.lastReportingBlocker?.label,
  }

  let suggestedPath: string | null = null
  if (hasOcr && !hasTx) suggestedPath = journal.path
  else if (hasTx && !hasReporting) suggestedPath = '/reports'
  else if (session.nextStep?.path) suggestedPath = session.nextStep.path

  return { steps: [scan, journal, reporting], suggestedPath }
}
