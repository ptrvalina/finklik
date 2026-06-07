/** Объединение ближайших событий для блока «Календарь бизнеса» на главной. */

export type BusinessCalendarEvent = {
  id: string
  date: string
  title: string
  subtitle?: string
  amount?: number | string | null
  to: string
  kind: 'tax' | 'report' | 'task' | 'meeting' | 'deadline' | 'other'
}

const OBLIGATION_RU: Record<string, string> = {
  tax: 'Налог',
  invoice: 'Счёт к оплате',
  salary: 'Зарплата',
  rent: 'Аренда',
}

const KIND_ROUTE: Record<BusinessCalendarEvent['kind'], string> = {
  tax: '/taxes',
  report: '/reports',
  task: '/planner',
  meeting: '/calendar',
  deadline: '/calendar',
  other: '/calendar',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateStr: string): number {
  const today = new Date(todayStr())
  const target = new Date(dateStr.slice(0, 10))
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

/** «Сегодня», «Через 3 дня», «Через неделю» и т.п. */
export function formatRelativeWhen(dateStr: string): string {
  const d = daysUntil(dateStr)
  if (d <= 0) return 'Сегодня'
  if (d === 1) return 'Завтра'
  if (d === 7) return 'Через неделю'
  if (d === 14) return 'Через 2 недели'
  if (d >= 2) {
    const mod = d % 10
    const mod100 = d % 100
    const word =
      mod === 1 && mod100 !== 11
        ? 'день'
        : mod >= 2 && mod <= 4 && (mod100 < 10 || mod100 >= 20)
          ? 'дня'
          : 'дней'
    return `Через ${d} ${word}`
  }
  const dt = new Date(dateStr.slice(0, 10))
  return dt.toLocaleDateString('ru-BY', { day: 'numeric', month: 'short' })
}

function mapEventKind(raw: string | undefined, title: string): BusinessCalendarEvent['kind'] {
  const hay = `${raw ?? ''} ${title}`.toLowerCase()
  if (hay.includes('налог') || raw === 'tax') return 'tax'
  if (hay.includes('отч') || raw === 'report' || raw === 'submission') return 'report'
  if (raw === 'meeting' || hay.includes('встреч')) return 'meeting'
  if (raw === 'salary' || hay.includes('зарплат')) return 'deadline'
  if (raw === 'task' || hay.includes('задач')) return 'task'
  if (raw === 'deadline' || raw === 'obligation') return 'deadline'
  return 'other'
}

function dedupeKey(e: BusinessCalendarEvent): string {
  return `${e.date}|${e.title.toLowerCase()}`
}

type RawCal = { id?: string; title: string; event_date: string; event_type?: string }
type RawTimeline = { id?: string; title: string; date?: string; kind?: string; subtitle?: string }
type RawObligation = { id: string; obligation_type: string; amount: string; due_date: string; status?: string }
type RawTask = { id: string; title: string; status: string; created_at?: string; due_date?: string | null }

export function mergeUpcomingBusinessEvents(input: {
  taxEvents?: RawCal[]
  userEvents?: RawCal[]
  timeline?: RawTimeline[]
  obligations?: RawObligation[]
  tasks?: RawTask[]
  limit?: number
  /** Не показывать события дальше N дней (по умолчанию 30). */
  maxDaysAhead?: number
}): BusinessCalendarEvent[] {
  const today = todayStr()
  const horizon = input.maxDaysAhead ?? 30
  const out: BusinessCalendarEvent[] = []
  const seen = new Set<string>()

  const push = (e: BusinessCalendarEvent) => {
    if (!e.date || e.date < today) return
    if (daysUntil(e.date) > horizon) return
    const key = dedupeKey(e)
    if (seen.has(key)) return
    seen.add(key)
    out.push(e)
  }

  for (const ob of input.obligations ?? []) {
    if (ob.status === 'paid') continue
    const kind = mapEventKind(ob.obligation_type, ob.obligation_type)
    const name = OBLIGATION_RU[ob.obligation_type] ?? ob.obligation_type
    push({
      id: `ob-${ob.id}`,
      date: ob.due_date,
      title: name,
      amount: ob.amount,
      subtitle: 'Обязательство',
      kind,
      to: kind === 'tax' ? '/taxes' : '/reports',
    })
  }

  for (const item of input.timeline ?? []) {
    if (!item.date || item.date < today) continue
    const kind = mapEventKind(item.kind, item.title)
    push({
      id: item.id ?? `tl-${item.date}-${item.title}`,
      date: item.date,
      title: item.title,
      subtitle: item.subtitle,
      kind,
      to: KIND_ROUTE[kind],
    })
  }

  for (const ev of [...(input.taxEvents ?? []), ...(input.userEvents ?? [])]) {
    const kind = mapEventKind(ev.event_type, ev.title)
    push({
      id: ev.id ?? `cal-${ev.event_date}-${ev.title}`,
      date: ev.event_date,
      title: ev.title,
      kind,
      to: KIND_ROUTE[kind],
    })
  }

  for (const task of input.tasks ?? []) {
    if (task.status === 'closed') continue
    const date = (task.due_date || task.created_at)?.slice(0, 10)
    if (!date) continue
    push({
      id: `task-${task.id}`,
      date,
      title: task.title,
      subtitle: 'Поручение',
      kind: 'task',
      to: '/planner',
    })
  }

  return out
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, input.limit ?? 7)
}
