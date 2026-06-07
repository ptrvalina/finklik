import { formatMoneyAmount } from './formatMoney'

type DomainEvent = {
  event_type: string
  payload?: Record<string, unknown>
  occurred_at_ms?: number
}

/** Человекочитаемые подписи для ленты «Последние события». */
export function domainEventToActivityLabel(ev: DomainEvent): { title: string; detail?: string } {
  const p = ev.payload ?? {}
  const desc = typeof p.description === 'string' ? p.description : undefined
  const amount = p.amount != null ? formatMoneyAmount(p.amount as number | string) : null
  const source = typeof p.source === 'string' ? p.source : ''

  switch (ev.event_type) {
    case 'TransactionCreated': {
      if (source === 'bank') {
        return { title: 'Импортирована выписка', detail: desc ?? (amount ? amount : undefined) }
      }
      if (source === 'scan') {
        return { title: 'Загружен документ', detail: desc ?? (amount ? amount : undefined) }
      }
      if (p.status === 'posted' || p.status === 'confirmed') {
        return { title: 'Проведена операция', detail: desc ?? (amount ? amount : undefined) }
      }
      return { title: 'Проведена операция', detail: desc ?? (amount ? amount : undefined) }
    }
    case 'TransactionUpdated':
      return { title: 'Обновлена операция', detail: desc ?? (amount ? amount : undefined) }
    case 'DocumentOcrProcessed':
    case 'OCRLinked':
      return { title: 'Загружен документ', detail: desc }
    case 'SubmissionCompleted':
      return { title: 'Подан отчёт', detail: typeof p.report_type === 'string' ? p.report_type : undefined }
    case 'ReportGenerated':
      return { title: 'Сформирован отчёт', detail: typeof p.report_type === 'string' ? p.report_type : undefined }
    case 'ReportValidated':
      return { title: 'Отчёт проверен', detail: undefined }
    case 'ReportPreparationStarted':
      return { title: 'Начата подготовка отчётности', detail: undefined }
    case 'DocumentSigned':
      return { title: 'Подписан отчёт', detail: desc }
    case 'ApprovalCompleted':
      return { title: 'Согласование завершено', detail: desc }
    case 'ApprovalRequested':
      return { title: 'Запрошено согласование', detail: desc }
    case 'ReconciliationConfirmed':
      return { title: 'Сверка с банком подтверждена', detail: undefined }
    case 'ReconciliationMatchRecorded':
      return { title: 'Операция сопоставлена с выпиской', detail: desc }
    case 'BusinessProfileCompleted':
      return { title: 'Профиль бизнеса заполнен', detail: undefined }
    default:
      return { title: 'Действие в системе', detail: desc }
  }
}

export function formatActivityWhen(occurredAtMs: number | undefined): string {
  if (!occurredAtMs) return ''
  const d = new Date(occurredAtMs)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  return d.toLocaleDateString('ru-BY', { day: 'numeric', month: 'short' })
}
