/** Единый словарь действий в operational UI (без «Открыть / Перейти / Начать»). */

export type OperationalVerb = 'continue' | 'review' | 'confirm' | 'post' | 'fix' | 'send'

export const OPERATIONAL_VERB_RU: Record<OperationalVerb, string> = {
  continue: 'Продолжить',
  review: 'Проверить',
  confirm: 'Подтвердить',
  post: 'Провести',
  fix: 'Исправить',
  send: 'Отправить',
}

export function verbLabel(verb: OperationalVerb): string {
  return OPERATIONAL_VERB_RU[verb]
}

/** CTA ленты исполнения по типу задачи. */
export function executionVerbForType(type: string): OperationalVerb {
  switch (type) {
    case 'document':
      return 'review'
    case 'transaction':
      return 'post'
    case 'reporting':
      return 'send'
    case 'reconciliation':
      return 'review'
    case 'approval':
      return 'confirm'
    default:
      return 'continue'
  }
}
