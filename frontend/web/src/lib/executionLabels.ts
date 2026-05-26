/** Человекочитаемые подписи для operational feed (без технического жаргона). */

import { riskLevelRu } from '../i18n/apiLabels.ru'

export const OPERATION_TYPE_RU: Record<string, string> = {
  transaction: 'Журнал',
  document: 'Сканер и OCR',
  approval: 'Комплаенс',
  reporting: 'Отчётность',
  reconciliation: 'Банк и сверка',
  tax: 'Налоги',
  payroll: 'Зарплата',
  inventory: 'Запасы',
  default: 'Задача',
}

/** Порядок групп в ленте исполнения (не Jira — один экран). */
export const EXECUTION_GROUP_ORDER = [
  'reporting',
  'reconciliation',
  'document',
  'transaction',
  'approval',
  'tax',
  'payroll',
  'inventory',
  'default',
] as const

export const OPERATION_PRIORITY_RU: Record<string, string> = {
  critical: 'Срочно',
  high: 'Важно',
  medium: 'Обычно',
  low: 'Позже',
}

/** @deprecated Используйте riskLevelRu из i18n/apiLabels.ru */
export const RISK_LEVEL_RU = riskLevelRu

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

/** Группы в фиксированном продуктовом порядке. */
export function groupOperationsOrdered<T extends { type: string }>(
  items: T[],
): Array<{ type: string; items: T[] }> {
  const map = groupOperationsByType(items)
  const ordered: Array<{ type: string; items: T[] }> = []
  for (const type of EXECUTION_GROUP_ORDER) {
    if (map[type]?.length) ordered.push({ type, items: map[type] })
  }
  for (const [type, groupItems] of Object.entries(map)) {
    if (!(EXECUTION_GROUP_ORDER as readonly string[]).includes(type)) {
      ordered.push({ type, items: groupItems })
    }
  }
  return ordered
}
