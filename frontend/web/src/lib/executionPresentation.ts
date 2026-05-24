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

export function executionRiskIfIgnored(priority: string): string | null {
  if (priority === 'critical') return 'Может сорвать срок сдачи или оплаты налогов.'
  if (priority === 'high') return 'Отчётность и налоги могут считаться по неполным данным.'
  return null
}

export function executionMetaLine(item: ExecutionTaskLike): string {
  return `${operationTypeLabel(item.type)} · ${operationPriorityLabel(item.priority)}`
}
