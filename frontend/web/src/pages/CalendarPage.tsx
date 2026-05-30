import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, taxApi } from '../api/client'
import AppModal from '../components/ui/AppModal'
import { Link } from 'react-router-dom'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const EVENT_COLORS: Record<string, string> = {
  tax: '#dc2626',
  deadline: '#c026d3',
  salary: '#059669',
  report: '#00a86b',
  meeting: '#2563eb',
  custom: '#52525b',
}
const EVENT_LABELS: Record<string, string> = {
  tax: 'Налог', deadline: 'Дедлайн', salary: 'Зарплата', report: 'Отчёт', meeting: 'Встреча', custom: 'Событие',
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

interface CalEvent { id: string; title: string; event_date: string; event_type: string; color: string; is_auto: boolean }

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ title: '', event_type: 'custom', color: EVENT_COLORS.custom })
  const qc = useQueryClient()

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const { data: taxCalendarData } = useQuery({
    queryKey: ['calendar-tax-events', year],
    queryFn: () => taxApi.calendar(year).then((r) => r.data),
  })
  const { data: userEventsData } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
      return api.get(`/calendar/events?date_from=${from}&date_to=${to}`).then(r => r.data)
    },
  })

  const userEvents: CalEvent[] = userEventsData || []
  const autoEvents: CalEvent[] = (taxCalendarData?.events || []).map((event: any, idx: number) => ({
    id: `tax-${year}-${idx}-${event.event_type}`,
    title: event.title,
    event_date: event.event_date,
    event_type: event.event_type,
    color: event.color || EVENT_COLORS[event.event_type] || EVENT_COLORS.deadline,
    is_auto: true,
  }))
  const allEvents = useMemo(() => [...autoEvents, ...userEvents], [autoEvents, userEvents])

  const upcoming = useMemo(() => {
    const todayStr = today.toISOString().slice(0, 10)
    return allEvents
      .filter((e) => e.event_date >= todayStr)
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title))
      .slice(0, 10)
  }, [allEvents, today])

  const taxDeadlines = upcoming.filter((e) => e.event_type === 'tax' || e.event_type === 'report' || e.event_type === 'deadline').length

  const addMutation = useMutation({
    mutationFn: () => api.post('/calendar/events', {
      title: newEvent.title, event_date: selectedDate, event_type: newEvent.event_type,
      color: EVENT_COLORS[newEvent.event_type] || newEvent.color,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); setShowAddModal(false); setNewEvent({ title: '', event_type: 'custom', color: EVENT_COLORS.custom }) },
  })

  function getEventsForDay(day: number): CalEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return allEvents.filter(e => e.event_date === dateStr)
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const monthNav = (
    <div className="flex w-fit items-center rounded-lg bg-surface-container-low p-1">
      <button type="button" onClick={prevMonth} className="rounded-md p-2 transition-colors hover:bg-surface-container-high" aria-label="Предыдущий месяц">
        <Icon name="chevron_left" className="text-lg" />
      </button>
      <button
        type="button"
        onClick={() => {
          setYear(today.getFullYear())
          setMonth(today.getMonth())
        }}
        className="px-3 py-1.5 text-xs font-label font-bold uppercase tracking-widest text-primary sm:px-4"
      >
        Сегодня
      </button>
      <button type="button" onClick={nextMonth} className="rounded-md p-2 transition-colors hover:bg-surface-container-high" aria-label="Следующий месяц">
        <Icon name="chevron_right" className="text-lg" />
      </button>
    </div>
  )

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {monthNav}
        <Link to="/reports" className="btn-secondary w-full sm:w-auto">
          <Icon name="assignment_turned_in" className="text-lg" /> Дедлайны
        </Link>
        <button
          type="button"
          className="btn-primary fc-btn-thumb w-full sm:w-auto"
          onClick={() => {
            setSelectedDate(today.toISOString().slice(0, 10))
            setShowAddModal(true)
          }}
        >
          <Icon name="add" className="text-lg" /> Событие
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Месяц</p>
          <p className="mt-1 font-headline text-base font-extrabold text-on-surface sm:text-lg">
            {MONTHS[month]} {year}
          </p>
          <p className="text-[11px] text-on-surface-variant">Текущий период</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">События</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{allEvents.length}</p>
          <p className="text-[11px] text-on-surface-variant">В месяце</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Ближайшие</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-primary sm:text-2xl">{upcoming.length}</p>
          <p className="text-[11px] text-on-surface-variant">С сегодня</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Налоги / отчёты</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-error sm:text-2xl">{taxDeadlines}</p>
          <p className="text-[11px] text-on-surface-variant">Дедлайны</p>
        </div>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_280px] lg:gap-6">
        <div className="flex min-h-0 flex-col gap-4">
      {/* Calendar grid */}
      <div className="glass-card flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl p-0 lg:min-h-[520px]">
        {/* Days header */}
        <div className="grid grid-cols-7 bg-surface-container-high">
          {DAYS.map(d => (
            <div key={d} className="py-4 text-center text-[10px] font-label font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="flex-1 grid grid-cols-7 gap-[1px] bg-outline-variant/10" style={{ gridTemplateRows: `repeat(${Math.ceil((startDow + daysInMonth) / 7)}, minmax(0, 1fr))` }}>
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`e-${i}`} className="bg-surface-container-low p-2" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const events = getEventsForDay(day)
            const isT = isToday(day)
            return (
              <div key={day} className="bg-surface-container-low p-2 hover:bg-surface-container transition-colors cursor-pointer relative group"
                onClick={() => { setSelectedDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); setShowAddModal(true) }}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-label mb-1 ${
                  isT ? 'bg-primary text-on-primary' : 'text-on-surface'
                }`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 2).map(ev => (
                    <div
                      key={ev.id}
                      className="truncate rounded-md border-l-2 p-1 text-[10px] font-bold text-on-surface"
                      style={{ borderLeftColor: ev.color, backgroundColor: `${ev.color}18` }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[10px] text-on-surface-variant px-1">+{events.length - 2}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(EVENT_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: EVENT_COLORS[type] }} />
            <span className="text-xs text-on-surface-variant font-medium">{label}</span>
          </div>
        ))}
      </div>
        </div>

        <aside className="glass-card flex flex-col rounded-2xl p-4 lg:max-h-[620px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Ближайшие сроки</p>
          <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {upcoming.length === 0 ? (
              <li className="text-sm text-on-surface-variant">Нет предстоящих событий в этом месяце.</li>
            ) : (
              upcoming.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-outline/40 bg-surface-container-low/60 p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ev.color }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tabular-nums text-on-surface-variant">
                        {new Date(ev.event_date).toLocaleDateString('ru-BY', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-sm font-medium text-on-surface">{ev.title}</p>
                      <p className="text-[10px] text-on-surface-variant">{EVENT_LABELS[ev.event_type] || ev.event_type}</p>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
          <Link to="/reports" className="btn-secondary mt-4 w-full text-center text-sm">
            К отчётности
          </Link>
        </aside>
      </div>

      {showAddModal && (
        <AppModal
          title="Новое событие"
          onClose={() => setShowAddModal(false)}
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowAddModal(false)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  disabled={!newEvent.title || !selectedDate || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                >
                  {addMutation.isPending ? 'Сохраняем...' : 'Создать'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                className="input min-h-11 rounded-xl"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Название</label>
              <input
                className="input min-h-11 rounded-xl"
                placeholder="Название"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Тип</label>
              <select
                className="input min-h-11 rounded-xl"
                value={newEvent.event_type}
                onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
              >
                {Object.entries(EVENT_LABELS)
                  .filter(([k]) => !['tax', 'report', 'salary', 'deadline'].includes(k))
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
              </select>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}
