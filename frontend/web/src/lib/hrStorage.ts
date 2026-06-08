/**
 * Кадровые документы и синхронизация с табелем (MVP — localStorage по организации).
 */

import { activeOrgId } from './queryKeys'

/** Приказ о предоставлении трудового / социального отпуска (ТК РБ). */
export type HrLeaveOrderType = 'labor' | 'social'

export type HrLeaveOrder = {
  id: string
  type: HrLeaveOrderType
  employee_id: string
  employee_name: string
  order_number: string
  order_date: string
  date_from: string
  date_to: string
  /** Для социального отпуска — основание (беременность, уход за ребёнком и т.д.) */
  social_reason?: string
  created_at: string
}

export type LaborBookEntry = {
  id: string
  employee_id: string
  employee_name: string
  event_type: 'hire' | 'dismiss' | 'transfer'
  event_date: string
  order_number: string
  order_date: string
  note?: string
}

const LEAVE_ORDER_LABELS: Record<HrLeaveOrderType, string> = {
  labor: 'Приказ о предоставлении трудового отпуска',
  social: 'Приказ о предоставлении социального отпуска',
}

/** Коды табеля (листок учёта рабочего времени, ориентир ТК РБ). */
export const TIMESHEET_LEAVE_CODE: Record<HrLeaveOrderType, string> = {
  labor: 'О',
  social: 'С',
}

function orgKey(suffix: string) {
  return `finklik_hr_${suffix}_${activeOrgId()}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function leaveOrderLabel(type: HrLeaveOrderType): string {
  return LEAVE_ORDER_LABELS[type]
}

export function listLeaveOrders(): HrLeaveOrder[] {
  return readJson<HrLeaveOrder[]>(orgKey('leave_orders'), [])
}

export function saveLeaveOrder(order: HrLeaveOrder) {
  const all = listLeaveOrders()
  writeJson(orgKey('leave_orders'), [order, ...all])
}

export function nextLeaveOrderNumber(): string {
  const n = readJson<number>(orgKey('leave_order_seq'), 0) + 1
  writeJson(orgKey('leave_order_seq'), n)
  return String(n)
}

export function listLaborBookEntries(): LaborBookEntry[] {
  return readJson<LaborBookEntry[]>(orgKey('labor_book'), [])
}

export function addLaborBookEntry(entry: LaborBookEntry) {
  const all = listLaborBookEntries()
  if (all.some((e) => e.id === entry.id)) return
  writeJson(orgKey('labor_book'), [...all, entry].sort((a, b) => a.event_date.localeCompare(b.event_date)))
}

function timesheetKey(year: number, month: number) {
  return `hr_timesheet_${year}_${month}`
}

function eachDayInRange(from: string, to: string): { year: number; month: number; day: number }[] {
  const start = new Date(from.slice(0, 10))
  const end = new Date(to.slice(0, 10))
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const out: { year: number; month: number; day: number }[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push({ year: cur.getFullYear(), month: cur.getMonth() + 1, day: cur.getDate() })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/** Проставить код отпуска в табеле за период приказа. */
export function applyLeaveToTimesheet(order: HrLeaveOrder) {
  const code = TIMESHEET_LEAVE_CODE[order.type]
  const byMonth = new Map<string, Record<string, Record<number, string>>>()

  for (const { year, month, day } of eachDayInRange(order.date_from, order.date_to)) {
    const k = timesheetKey(year, month)
    if (!byMonth.has(k)) {
      byMonth.set(k, readJson<Record<string, Record<number, string>>>(k, {}))
    }
    const cells = byMonth.get(k)!
    cells[order.employee_id] = { ...(cells[order.employee_id] || {}), [day]: code }
  }

  for (const [k, cells] of byMonth) {
    writeJson(k, cells)
  }
}

export function buildLeaveOrderText(order: HrLeaveOrder, orgName = 'Организация'): string {
  const title = leaveOrderLabel(order.type)
  const period = `${formatRuDate(order.date_from)} — ${formatRuDate(order.date_to)}`
  const lines = [
    title.toUpperCase(),
    '',
    `№ ${order.order_number} от ${formatRuDate(order.order_date)}`,
    '',
    `ПРИКАЗЫВАЮ:`,
    '',
    `Предоставить ${order.employee_name} ${
      order.type === 'labor' ? 'трудовой отпуск' : 'социальный отпуск'
    } на период ${period}.`,
  ]
  if (order.type === 'social' && order.social_reason) {
    lines.push(`Основание: ${order.social_reason}.`)
  }
  lines.push('', `Организация: ${orgName}`, '', 'Руководитель _________________')
  return lines.join('\n')
}

function formatRuDate(iso: string): string {
  const d = new Date(iso.slice(0, 10))
  return d.toLocaleDateString('ru-BY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Слить приказы об отпуске в ячейки табеля (при открытии табеля). */
export function mergeLeaveOrdersIntoTimesheet(
  year: number,
  month: number,
  cells: Record<string, Record<number, string>>,
): Record<string, Record<number, string>> {
  const next = { ...cells }
  for (const order of listLeaveOrders()) {
    const code = TIMESHEET_LEAVE_CODE[order.type]
    for (const { year: y, month: m, day } of eachDayInRange(order.date_from, order.date_to)) {
      if (y !== year || m !== month) continue
      next[order.employee_id] = { ...(next[order.employee_id] || {}), [day]: code }
    }
  }
  return next
}
