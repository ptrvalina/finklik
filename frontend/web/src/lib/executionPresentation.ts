import { operationPriorityLabel, operationTypeLabel } from './executionLabels'

export type ExecutionTaskLike = {
  id: string
  type: string
  priority: string
  title: string
  context?: string | null
  action_path?: string | null
  ai_why?: string | null
  state_transition_hint?: string | null
  truth_confidence?: number | null
}

export function executionCtaLabel(type: string): string {
  switch (type) {
    case 'document':
      return 'Проверить документ'
    case 'transaction':
      return 'Открыть в журнале'
    case 'reporting':
      return 'К отчётности'
    case 'reconciliation':
      return 'Сверить'
    case 'approval':
      return 'Согласовать'
    default:
      return 'Сделать'
  }
}

export function executionTimeHint(type: string, priority: string): string {
  if (priority === 'critical') return '~2 мин'
  if (type === 'document') return '~20 сек'
  if (type === 'transaction') return '~1 мин'
  return '~3 мин'
}

export function executionRiskIfIgnored(priority: string, type?: string): string | null {
  if (priority === 'critical') {
    if (type === 'reporting') return 'Риск просрочки сдачи и штрафов по налогам РБ.'
    if (type === 'document') return 'Без первички отчётность и КУДиР будут неполными при проверке.'
    return 'Может сорвать срок сдачи или оплаты налогов.'
  }
  if (priority === 'high') {
    if (type === 'transaction') return 'Черновики в журнале искажают готовность и налоговую базу.'
    if (type === 'approval') return 'Блокирует проведение и закрытие периода.'
    return 'Отчётность и налоги могут считаться по неполным данным.'
  }
  if (priority === 'medium' && (type === 'document' || type === 'reconciliation')) {
    return 'Задержка накапливает расхождения перед закрытием месяца.'
  }
  return null
}

export function executionConfidenceLabel(confidence: number | null | undefined): string | null {
  if (confidence == null || Number.isNaN(confidence)) return null
  const pct = Math.round(confidence * 100)
  if (pct >= 85) return `уверенность ${pct}%`
  if (pct >= 60) return `проверьте данные · ${pct}%`
  return `низкая уверенность · ${pct}%`
}

export function executionConfidenceTone(confidence: number | null | undefined): 'ok' | 'warn' | 'low' {
  if (confidence == null) return 'ok'
  if (confidence >= 0.85) return 'ok'
  if (confidence >= 0.6) return 'warn'
  return 'low'
}

export function executionMetaLine(item: ExecutionTaskLike): string {
  return `${operationTypeLabel(item.type)} · ${operationPriorityLabel(item.priority)}`
}
