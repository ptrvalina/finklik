/** Payload сервера для события WebSocket `report_status`. */
export type ReportStatusPayload = {
  submission_id?: string
  status?: string
  portal_outcome?: string
  submission_ref?: string | null
  authority_label?: string
  report_period?: string
  message?: string
  rejection_reason?: string | null
}

export type ReportStatusToastShape = {
  title: string
  body: string
  variant: 'success' | 'error' | 'info'
}

export function formatReportStatusToast(payload: ReportStatusPayload): ReportStatusToastShape {
  const outcome = String(payload.portal_outcome || '')
  const accepted = outcome === 'accepted'
  const rejected = outcome === 'rejected' || outcome === 'error'

  let title = 'Обновление статуса отчёта'
  if (accepted) title = 'Отчёт принят порталом'
  else if (rejected) title = 'Отчёт не принят'

  const meta: string[] = []
  if (payload.authority_label) meta.push(payload.authority_label)
  if (payload.report_period) meta.push(`период ${payload.report_period}`)
  if (payload.submission_ref) meta.push(`реф. ${payload.submission_ref}`)
  const head = meta.join(' · ')
  const detail = (payload.message || payload.rejection_reason || '').trim()
  const body = [head, detail].filter(Boolean).join('\n') || 'Статус подачи обновлён.'

  const variant: ReportStatusToastShape['variant'] = accepted ? 'success' : rejected ? 'error' : 'info'
  return { title, body, variant }
}
