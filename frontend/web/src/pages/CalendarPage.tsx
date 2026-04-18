import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import AppModal from '../components/ui/AppModal'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const EVENT_COLORS: Record<string, string> = {
  tax: '#dc2626',
  deadline: '#c026d3',
  salary: '#059669',
  report: '#0d9488',
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

function generateTaxEvents(year: number, month: number): CalEvent[] {
  const m = month + 1, y = year, events: CalEvent[] = []
  events.push({ id: `auto-nds-${y}-${m}`, title: 'Декларация НДС', event_date: `${y}-${String(m).padStart(2,'0')}-20`, event_type: 'report', color: EVENT_COLORS.report, is_auto: true })
  events.push({ id: `auto-salary-${y}-${m}`, title: 'Выплата зарплаты', event_date: `${y}-${String(m).padStart(2,'0')}-15`, event_type: 'salary', color: EVENT_COLORS.salary, is_auto: true })
  if ([3, 6, 9, 12].includes(m)) {
    const nextM = m === 12 ? 1 : m + 1, nextY = m === 12 ? y + 1 : y
    events.push({ id: `auto-usn-${y}-${m}`, title: 'Уплата УСН', event_date: `${nextY}-${String(nextM).padStart(2,'0')}-25`, event_type: 'tax', color: EVENT_COLORS.tax, is_auto: true })
    events.push({ id: `auto-fsszn-${y}-${m}`, title: 'Уплата ФСЗН', event_date: `${nextY}-${String(nextM).padStart(2,'0')}-15`, event_type: 'deadline', color: EVENT_COLORS.deadline, is_auto: true })
  }
  return events
}

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

  const autoEvents = generateTaxEvents(year, month)
  const { data: userEventsData } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
      return api.get(`/calendar/events?date_from=${from}&date_to=${to}`).then(r => r.data)
    },
  })

  const userEvents: CalEvent[] = userEventsData || []
  const allEvents = [...autoEvents, ...userEvents]

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

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-7xl flex-col space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">
            {MONTHS[month]} {year}
          </h1>
          <div className="flex w-fit items-center rounded-lg bg-surface-container-low p-1">
            <button type="button" onClick={prevMonth} className="rounded-md p-2 transition-colors hover:bg-surface-container-high">
              <Icon name="chevron_left" className="text-lg" />
            </button>
            <button
              type="button"
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
              className="px-3 py-1.5 text-xs font-label font-bold uppercase tracking-widest text-primary sm:px-4"
            >
              Сегодня
            </button>
            <button type="button" onClick={nextMonth} className="rounded-md p-2 transition-colors hover:bg-surface-container-high">
              <Icon name="chevron_right" className="text-lg" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="-mx-1 flex overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mr-4 sm:overflow-visible sm:pb-0">
            <div className="flex min-w-max gap-1 rounded-lg bg-surface-container-low p-1">
              <button type="button" className="whitespace-nowrap rounded-md bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface sm:px-4">
                Месяц
              </button>
              <button type="button" className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface sm:px-4">
                Неделя
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary min-h-12 w-full sm:w-auto"
            onClick={() => {
              setSelectedDate(today.toISOString().slice(0, 10))
              setShowAddModal(true)
            }}
          >
            <Icon name="add" className="text-lg" /> Событие
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-surface shadow-card dark:border-zinc-700/80">
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
                      className="truncate rounded-md border-l-2 p-1 text-[10px] font-bold text-zinc-900"
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

      {showAddModal && (
        <AppModal
          title="Новое событие"
          onClose={() => setShowAddModal(false)}
          footer={
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
