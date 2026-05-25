/** Человекочитаемые подписи событий в баннере (не сырой event code). */
export function notificationEventLabel(event: string): string {
  const map: Record<string, string> = {
    report_status: 'Статус отчёта',
    transaction_posted: 'Проводка',
    document_scanned: 'Документ',
    work_pack_ack: 'Пакет работ',
    approval_completed: 'Согласование',
    inbox_updated: 'Входящие',
    signing_completed: 'Подпись',
    org_switch: 'Организация',
  }
  return map[event] ?? 'Уведомление'
}
