/**
 * RU-подписи для кодов API (EN enum → бухгалтерский язык).
 * Использовать через labelApiCode() вместо сырого code в UI.
 */

export const riskLevelRu: Record<string, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'повышенный',
  critical: 'критический',
}

export const reportingStatusRu: Record<string, string> = {
  ready: 'готова к сдаче',
  preparing: 'в подготовке',
  at_risk: 'под риском',
  blocked: 'заблокирована',
}

export const complianceLevelRu: Record<string, string> = {
  clear: 'в норме',
  attention: 'нужны действия',
  risk: 'есть риск',
  critical: 'критично',
}

export const healthSignalRu: Record<string, string> = {
  healthy: 'стабильно',
  strained: 'напряжённо',
  critical: 'критично',
}

export const trustLevelRu: Record<string, string> = {
  observe_only: 'только наблюдение',
  suggest_only: 'подсказки',
  prepare_only: 'подготовка действий',
  auto_execute_safe: 'безопасные авто-действия',
}

export const autonomyModeRu: Record<string, string> = {
  observe: 'наблюдение',
  suggest: 'подсказки',
  prepare: 'подготовка',
  execute_with_approval: 'исполнение с подтверждением',
}

export const readinessBlockerRu: Record<string, string> = {
  drafts: 'Черновики в журнале',
  uncategorized: 'Расходы без категории',
  scans: 'Документы на проверке OCR',
  overdue_obligations: 'Просроченные обязательства',
  duplicates: 'Возможные дубликаты операций',
}

export const jobDomainRu: Record<string, string> = {
  scanner: 'Сканер и OCR',
  ocr: 'Распознавание',
  reporting: 'Отчётность',
  compliance: 'Комплаенс',
  payroll: 'Зарплата',
  bank: 'Банк',
  reconciliation: 'Сверка',
  notifications: 'Уведомления',
  default: 'Фоновая задача',
}

/** Снимок состояния: уровень / статус / сигнал. */
export function labelApiCode(
  map: Record<string, string>,
  code: string | null | undefined,
  fallback = '—',
): string {
  if (!code) return fallback
  const direct = map[code] ?? map[code.toLowerCase()]
  if (direct) return direct
  return code.replace(/_/g, ' ')
}

export function reportingStatusLabel(status: string | null | undefined): string {
  return labelApiCode(reportingStatusRu, status)
}

export function trustLevelLabel(level: string | null | undefined): string {
  return labelApiCode(trustLevelRu, level)
}

export function autonomyModeLabel(mode: string | null | undefined): string {
  return labelApiCode(autonomyModeRu, mode)
}

export function jobDomainLabel(domain: string | null | undefined): string {
  if (!domain) return jobDomainRu.default
  return labelApiCode(jobDomainRu, domain, jobDomainRu.default)
}
