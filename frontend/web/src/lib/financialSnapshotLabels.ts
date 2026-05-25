/** RU-подписи для enum-полей снимка состояния (API отдаёт EN-коды). */
const LEVEL: Record<string, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
  critical: 'критический',
  ok: 'в норме',
  attention: 'внимание',
  risk: 'риск',
}

export function snapshotLevelRu(code: string | undefined | null): string {
  if (!code) return '—'
  return LEVEL[code] ?? code
}
