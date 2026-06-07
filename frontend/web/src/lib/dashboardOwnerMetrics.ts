/** Расчёты для Business Hero — только на существующих API-данных. */

type MonthRow = { month: number; label: string; income: number; expense: number }

export type SparkPoint = { label: string; net: number }

export function buildSparkline(months: MonthRow[] | undefined, take = 6): SparkPoint[] {
  if (!months?.length) return []
  const currentMonth = new Date().getMonth() + 1
  return months
    .filter((m) => m.month <= currentMonth && (m.income > 0 || m.expense > 0))
    .slice(-take)
    .map((m) => ({ label: m.label, net: m.income - m.expense }))
}

export function computeMonthOverMonth(months: MonthRow[] | undefined): {
  currentNet: number
  delta: number
  pct: number | null
} | null {
  if (!months?.length) return null
  const now = new Date()
  const cm = now.getMonth() + 1
  const pm = cm === 1 ? 12 : cm - 1
  const cur = months.find((m) => m.month === cm)
  const prev = months.find((m) => m.month === pm)
  if (!cur) return null
  const currentNet = cur.income - cur.expense
  const prevNet = prev ? prev.income - prev.expense : 0
  const delta = currentNet - prevNet
  const pct = prevNet !== 0 ? (delta / Math.abs(prevNet)) * 100 : null
  return { currentNet, delta, pct }
}

export function sumNetFromTransactions(
  items: { type?: string; amount?: number | string }[] | undefined,
): number {
  if (!items?.length) return 0
  return items.reduce((acc, tx) => {
    const n = Number(tx.amount ?? 0)
    if (!Number.isFinite(n)) return acc
    if (tx.type === 'income') return acc + n
    if (tx.type === 'expense') return acc - n
    return acc
  }, 0)
}

export function dateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export type CalendarBucket = 'today' | 'week' | 'month'

export function calendarBucket(dateStr: string): CalendarBucket | null {
  const d = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateStr.slice(0, 10))
    target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
  })()
  if (d <= 0) return 'today'
  if (d <= 7) return 'week'
  if (d <= 30) return 'month'
  return null
}

export const CALENDAR_BUCKET_LABEL: Record<CalendarBucket, string> = {
  today: 'Сегодня',
  week: 'Ближайшие 7 дней',
  month: 'Ближайшие 30 дней',
}
