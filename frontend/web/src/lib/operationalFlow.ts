import type { OperationalSessionV1 } from './operationalSession'

export type FlowStepId = 'scan' | 'verify' | 'journal' | 'reporting' | 'signing'
export type FlowStepState = 'idle' | 'active' | 'done'

export type OperationalFlowStep = {
  id: FlowStepId
  title: string
  state: FlowStepState
  path: string
  hint?: string
}

/** Цепочка Скан → Проверка → Журнал → Отчётность → Подпись. */
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
    path: '/scan',
    hint: 'Загрузить документ',
  }

  const verify: OperationalFlowStep = {
    id: 'verify',
    title: 'Проверка',
    state: hasOcr && !hasTx ? 'active' : hasTx ? 'done' : 'idle',
    path: session.lastOcrDoc
      ? `/scan?doc_id=${encodeURIComponent(session.lastOcrDoc.id)}`
      : '/scan',
    hint: hasOcr ? 'Проверить поля документа' : undefined,
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
    hint: hasTx ? session.lastTransaction!.title : hasOcr ? 'Провести операцию' : undefined,
  }

  let reportingState: FlowStepState = 'idle'
  if (hasReporting) reportingState = 'done'
  else if (hasTx) reportingState = 'active'

  const reporting: OperationalFlowStep = {
    id: 'reporting',
    title: 'Отчётность',
    state: reportingState,
    path: session.lastReportingBlocker?.path ?? '/reports',
    hint: session.lastReportingBlocker?.label ?? 'Проверить готовность периода',
  }

  let signingState: FlowStepState = 'idle'
  if (hasReporting) signingState = 'done'
  else if (hasTx) signingState = 'active'

  const signing: OperationalFlowStep = {
    id: 'signing',
    title: 'Подпись',
    state: signingState,
    path: '/reports/imns',
    hint: 'Подписать и отправить отчёт',
  }

  let suggestedPath: string | null = null
  if (!hasOcr) suggestedPath = '/scan'
  else if (hasOcr && !hasTx) suggestedPath = verify.path
  else if (hasTx && !hasReporting) suggestedPath = '/reports'
  else if (session.nextStep?.path) suggestedPath = session.nextStep.path

  return { steps: [scan, verify, journal, reporting, signing], suggestedPath }
}
