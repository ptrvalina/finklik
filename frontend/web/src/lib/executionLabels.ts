/** Человекочитаемые подписи для operational feed (без технического жаргона). */

export const OPERATION_TYPE_RU: Record<string, string> = {
  transaction: 'Журнал',
  document: 'Документы',
  approval: 'Согласование',
  reporting: 'Отчётность',
  reconciliation: 'Сверка',
  tax: 'Налоги',
  payroll: 'Зарплата',
  inventory: 'Запасы',
  default: 'Задача',
}

export const OPERATION_PRIORITY_RU: Record<string, string> = {
  critical: 'Срочно',
  high: 'Важно',
  medium: 'Обычно',
  low: 'Позже',
}

export const RISK_LEVEL_RU: Record<string, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'повышенный',
  critical: 'критический',
}

export function operationTypeLabel(type: string): string {
  return OPERATION_TYPE_RU[type] || OPERATION_TYPE_RU.default
}

export function operationPriorityLabel(priority: string): string {
  return OPERATION_PRIORITY_RU[priority] || priority
}

export function groupOperationsByType<T extends { type: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const key = item.type || 'default'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}
