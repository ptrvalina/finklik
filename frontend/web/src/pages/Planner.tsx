import { FormEvent, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarApi, plannerApi, teamApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { CardSkeleton } from '../components/premium'
import OperationalPage from '../components/shell/OperationalPage'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const IMPORTANCE = [
  { label: 'Низкая', color: '#94A3B8' },
  { label: 'Обычная', color: '#2563EB' },
  { label: 'Высокая', color: '#EA580C' },
  { label: 'Срочная', color: '#DC2626' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function fmtLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function monthBounds(y: number, m: number) {
  const from = fmtLocalDate(new Date(y, m - 1, 1))
  const to = fmtLocalDate(new Date(y, m, 0))
  return { date_from: from, date_to: to }
}

/** Неделя пн–вс для произвольной даты. */
function weekBoundsAround(ref: Date) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { period_start: fmtLocalDate(mon), period_end: fmtLocalDate(sun) }
}

function buildMonthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0).getDate()
  let startDow = first.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const weeks: (number | null)[][] = []
  let cur: (number | null)[] = Array(7).fill(null)
  let pos = startDow
  for (let day = 1; day <= last; day++) {
    cur[pos] = day
    pos++
    if (pos === 7) {
      weeks.push(cur)
      cur = Array(7).fill(null)
      pos = 0
    }
  }
  if (cur.some((x) => x !== null)) weeks.push(cur)
  return weeks
}

type PlannerTask = {
  id: string
  title: string
  description?: string
  assignee_id: string
  author_id: string
  status: string
  created_at: string
  closed_at?: string | null
}

type PlannerComment = {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
}

type CalEvent = {
  id: string
  title: string
  description?: string | null
  event_date: string
  event_type: string
  color: string
  is_auto: boolean
  all_day?: boolean
  time_start?: string | null
  time_end?: string | null
  is_completed?: boolean
  remind_email?: boolean
  remind_telegram?: boolean
}

export default function Planner() {
  const user = useAuthStore((s) => s.user)
  const role = (user?.role || '').toLowerCase()
  const canRequestReport = role === 'owner' || role === 'admin'
  const qc = useQueryClient()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)

  const [viewMode, setViewMode] = useState<'mine' | 'assigned'>('mine')
  const [taskKind, setTaskKind] = useState<'task' | 'report_request'>('task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [reportText, setReportText] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})

  const [prodTab, setProdTab] = useState<'week' | 'month'>('month')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formAllDay, setFormAllDay] = useState(true)
  const [formTimeStart, setFormTimeStart] = useState('09:00')
  const [formTimeEnd, setFormTimeEnd] = useState('10:00')
  const [formColor, setFormColor] = useState(IMPORTANCE[1].color)
  const [formRemindEmail, setFormRemindEmail] = useState(false)
  const [formRemindTg, setFormRemindTg] = useState(false)
  const [formDesc, setFormDesc] = useState('')
  const [calendarSaveError, setCalendarSaveError] = useState<string | null>(null)

  const range = useMemo(() => monthBounds(viewYear, viewMonth), [viewYear, viewMonth])
  const weeks = useMemo(() => buildMonthWeeks(viewYear, viewMonth), [viewYear, viewMonth])

  const eventsQuery = useQuery({
    queryKey: ['calendar-events', viewYear, viewMonth],
    queryFn: () => calendarApi.listEvents(range).then((r) => r.data as CalEvent[]),
  })

  const allTasksQuery = useQuery({
    queryKey: ['planner', 'all'],
    queryFn: () => plannerApi.listTasks('all').then((r) => r.data as PlannerTask[]),
  })

  const prodRange = useMemo(() => {
    if (prodTab === 'month') {
      const { date_from, date_to } = monthBounds(viewYear, viewMonth)
      return { period_start: date_from, period_end: date_to }
    }
    return weekBoundsAround(new Date())
  }, [prodTab, viewYear, viewMonth])

  const productivityQuery = useQuery({
    queryKey: ['calendar-productivity', prodRange.period_start, prodRange.period_end],
    queryFn: () =>
      calendarApi
        .productivitySummary({ period_start: prodRange.period_start, period_end: prodRange.period_end })
        .then((r) => r.data as any),
  })

  const myTasksQuery = useQuery({
    queryKey: ['planner', 'mine'],
    queryFn: () => plannerApi.listTasks('mine').then((r) => r.data as PlannerTask[]),
  })
  const assignedTasksQuery = useQuery({
    queryKey: ['planner', 'assigned'],
    queryFn: () => plannerApi.listTasks('assigned').then((r) => r.data as PlannerTask[]),
  })
  const membersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: () => teamApi.listMembers().then((r) => r.data?.members ?? []),
  })

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const assignees = useMemo(
    () => members.filter((m: any) => ['owner', 'admin', 'accountant'].includes((m.role || '').toLowerCase())),
    [members],
  )

  const eventsByDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    for (const e of eventsQuery.data ?? []) {
      const k = e.event_date.slice(0, 10)
      if (!m[k]) m[k] = []
      m[k].push(e)
    }
    return m
  }, [eventsQuery.data])

  const tasksByDay = useMemo(() => {
    const m: Record<string, PlannerTask[]> = {}
    const y = viewYear
    const mo = viewMonth
    for (const t of allTasksQuery.data ?? []) {
      const c = new Date(t.created_at)
      if (c.getFullYear() !== y || c.getMonth() + 1 !== mo) continue
      const k = fmtLocalDate(c)
      if (!m[k]) m[k] = []
      m[k].push(t)
    }
    return m
  }, [allTasksQuery.data, viewYear, viewMonth])

  const createTaskMutation = useMutation({
    mutationFn: () =>
      plannerApi.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assignee_id: assigneeId,
        attachments: attachments
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      qc.invalidateQueries({ queryKey: ['planner'] })
    },
  })

  const closeTaskMutation = useMutation({
    mutationFn: (taskId: string) => plannerApi.closeTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planner'] }),
  })

  const reportMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      plannerApi.createReport(taskId, { content, attachments: [] }),
    onSuccess: (_, vars) => {
      setReportText((prev) => ({ ...prev, [vars.taskId]: '' }))
      qc.invalidateQueries({ queryKey: ['planner'] })
    },
  })
  const commentMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) => plannerApi.addComment(taskId, { content }),
    onSuccess: (_, vars) => {
      setCommentText((prev) => ({ ...prev, [vars.taskId]: '' }))
      qc.invalidateQueries({ queryKey: ['planner-comments', vars.taskId] })
    },
  })

  const saveEventMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        event_date: formDate,
        event_type: 'custom',
        color: formColor,
        remind_days_before: 1,
        all_day: formAllDay,
        remind_email: formRemindEmail,
        remind_telegram: formRemindTg,
      }
      if (formAllDay) {
        payload.time_start = null
        payload.time_end = null
      } else {
        payload.time_start = formTimeStart
        payload.time_end = formTimeEnd || null
      }
      if (editing?.id) {
        await calendarApi.updateEvent(editing.id, payload)
      } else {
        await calendarApi.createEvent(payload)
      }
    },
    onSuccess: () => {
      setCalendarSaveError(null)
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['calendar-productivity'] })
      setModalOpen(false)
      setEditing(null)
    },
    onError: (e: any) => {
      const d = e?.response?.data?.detail
      const msg =
        typeof d === 'string'
          ? d
          : Array.isArray(d)
            ? d.map((x: any) => x?.msg || x).join('; ')
            : e?.message || 'Не удалось сохранить событие'
      setCalendarSaveError(msg)
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['calendar-productivity'] })
      setModalOpen(false)
      setEditing(null)
    },
  })

  const completeEventMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => calendarApi.completeEvent(id, done),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['calendar-productivity'] })
    },
  })

  function openCreate(prefDate?: string) {
    setEditing(null)
    setFormTitle('')
    setFormDesc('')
    setFormDate(prefDate || fmtLocalDate(new Date(viewYear, viewMonth - 1, 15)))
    setFormAllDay(true)
    setFormTimeStart('09:00')
    setFormTimeEnd('10:00')
    setFormColor(IMPORTANCE[1].color)
    setFormRemindEmail(false)
    setFormRemindTg(false)
    setModalOpen(true)
  }

  function openEdit(ev: CalEvent) {
    setEditing(ev)
    setFormTitle(ev.title)
    setFormDesc(ev.description || '')
    setFormDate(ev.event_date.slice(0, 10))
    setFormAllDay(ev.all_day !== false)
    setFormTimeStart(ev.time_start || '09:00')
    setFormTimeEnd(ev.time_end || '10:00')
    setFormColor(ev.color || IMPORTANCE[1].color)
    setFormRemindEmail(!!ev.remind_email)
    setFormRemindTg(!!ev.remind_telegram)
    setModalOpen(true)
  }

  function onCreateTask(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !assigneeId) return
    createTaskMutation.mutate()
  }

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear((y) => y - 1)
    } else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear((y) => y + 1)
    } else setViewMonth((m) => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <OperationalPage
      eyebrow="Команда"
      title="Планер"
      description="Календарь событий и задачи организации. Задачи из списка отображаются в сетке месяца по дате создания."
      primaryAction={
        <button type="button" className="btn-primary fc-btn-thumb shrink-0" onClick={() => openCreate()}>
          + Событие
        </button>
      }
    >
      <div className="card-elevated space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary px-2 py-1 text-sm" onClick={prevMonth}>
              ←
            </button>
            <h2 className="min-w-[200px] text-center text-lg font-semibold capitalize">{monthLabel}</h2>
            <button type="button" className="btn-secondary px-2 py-1 text-sm" onClick={nextMonth}>
              →
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-on-surface-variant">
              Год
              <input
                className="input ml-1 w-24 py-1"
                type="number"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
              />
            </label>
            <label className="text-on-surface-variant">
              Месяц
              <select className="input ml-1 w-28 py-1" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleString('ru-RU', { month: 'long' })}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                const t = new Date()
                setViewYear(t.getFullYear())
                setViewMonth(t.getMonth() + 1)
              }}
            >
              Сегодня
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-on-surface-variant">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>

        {eventsQuery.isLoading ? (
          <div className="grid grid-cols-7 gap-1" aria-busy="true" aria-label="Загрузка календаря">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="min-h-[72px] rounded-lg fc-skeleton-shimmer sm:min-h-[100px]" aria-hidden />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {weeks.map((row, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {row.map((day, di) => {
                  if (day === null) return <div key={di} className="min-h-[100px] rounded-lg bg-surface-container-low/30" />
                  const key = `${viewYear}-${pad(viewMonth)}-${pad(day)}`
                  const evs = eventsByDay[key] || []
                  const tks = tasksByDay[key] || []
                  const isToday =
                    new Date().toDateString() === new Date(viewYear, viewMonth - 1, day).toDateString()
                  return (
                    <div
                      role="presentation"
                      key={key}
                      onClick={() => openCreate(key)}
                      className={`min-h-[100px] cursor-pointer rounded-lg border border-outline/50 p-1 text-left align-top transition hover:border-primary/50 ${
                        isToday ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container-low/40'
                      }`}
                    >
                      <span className="text-xs font-semibold text-on-surface">{day}</span>
                      <div className="mt-1 flex max-h-[72px] flex-col gap-0.5 overflow-hidden">
                        {evs.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(ev)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation()
                                openEdit(ev)
                              }
                            }}
                            className={`truncate rounded px-1 py-0.5 text-[10px] text-white ${
                              ev.is_completed ? 'opacity-50 line-through' : ''
                            }`}
                            style={{ backgroundColor: ev.color || '#2563EB' }}
                            title={ev.title}
                          >
                            {ev.is_auto ? '★ ' : ''}
                            {ev.all_day === false && ev.time_start ? `${ev.time_start} ` : ''}
                            {ev.title}
                          </span>
                        ))}
                        {evs.length > 3 ? <span className="text-[10px] text-on-surface-variant">+{evs.length - 3} событ.</span> : null}
                        {tks.slice(0, 2).map((tk) => (
                          <span
                            key={tk.id}
                            className="truncate rounded border border-emerald-600/40 bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-200"
                            title={tk.title}
                          >
                            ▢ {tk.title}
                          </span>
                        ))}
                        {tks.length > 2 ? <span className="text-[10px] text-on-surface-variant">+{tks.length - 2} задач</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-elevated space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Продуктивность</h3>
          <div className="inline-flex rounded-xl border border-outline/70 p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-sm font-medium ${prodTab === 'week' ? 'bg-primary text-on-primary' : ''}`}
              onClick={() => setProdTab('week')}
            >
              Неделя
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-sm font-medium ${prodTab === 'month' ? 'bg-primary text-on-primary' : ''}`}
              onClick={() => setProdTab('month')}
            >
              Месяц (на экране)
            </button>
          </div>
        </div>
        {productivityQuery.isLoading ? (
          <p className="text-sm text-on-surface-variant">Считаем…</p>
        ) : productivityQuery.data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-outline/60 p-3">
              <p className="text-xs text-on-surface-variant">Завершено событий</p>
              <p className="text-2xl font-semibold">{productivityQuery.data.completed_calendar_events}</p>
            </div>
            <div className="rounded-xl border border-outline/60 p-3">
              <p className="text-xs text-on-surface-variant">Закрыто задач планера</p>
              <p className="text-2xl font-semibold">{productivityQuery.data.completed_planner_tasks}</p>
            </div>
            <div className="rounded-xl border border-outline/60 p-3">
              <p className="text-xs text-on-surface-variant">Событий в периоде</p>
              <p className="text-2xl font-semibold">{productivityQuery.data.total_calendar_events_in_period}</p>
            </div>
            <div className="rounded-xl border border-outline/60 p-3">
              <p className="text-xs text-on-surface-variant">Индекс ({prodTab === 'week' ? 'неделя' : 'месяц'})</p>
              <p className="text-2xl font-semibold">{Math.round((productivityQuery.data.productivity_ratio || 0) * 100)}%</p>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-on-surface-variant">
          Период: {prodRange.period_start} — {prodRange.period_end}. Индекс = (завершённые события + закрытые задачи) / (события в периоде +
          новые задачи в периоде).
        </p>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto space-y-3 p-6">
            <h3 className="text-lg font-semibold">{editing ? 'Событие' : 'Новое событие'}</h3>
            <input className="input" placeholder="Название" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            <label className="block text-sm text-on-surface-variant">
              Дата
              <input className="input mt-1" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} />
              Весь день
            </label>
            {!formAllDay ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-on-surface-variant">
                  Начало
                  <input className="input mt-1" type="time" value={formTimeStart} onChange={(e) => setFormTimeStart(e.target.value)} />
                </label>
                <label className="text-xs text-on-surface-variant">
                  Конец
                  <input className="input mt-1" type="time" value={formTimeEnd} onChange={(e) => setFormTimeEnd(e.target.value)} />
                </label>
              </div>
            ) : null}
            <label className="block text-sm text-on-surface-variant">
              Важность (цвет)
              <select className="input mt-1" value={formColor} onChange={(e) => setFormColor(e.target.value)}>
                {IMPORTANCE.map((x) => (
                  <option key={x.color} value={x.color}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <textarea className="input min-h-[72px]" placeholder="Описание" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            {!user?.organization_id ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Нет привязки к организации — события календаря недоступны. Выполните вход под пользователем с организацией или обновите БД (
                <code className="font-mono text-[10px]">alembic upgrade head</code>).
              </p>
            ) : null}
            {calendarSaveError ? (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{calendarSaveError}</p>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formRemindEmail} onChange={(e) => setFormRemindEmail(e.target.checked)} />
              Напоминание на e-mail (при сохранении отправится тестовое уведомление, если почта настроена на сервере)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formRemindTg} onChange={(e) => setFormRemindTg(e.target.checked)} />
              Уведомление в Telegram (нужен TELEGRAM_BOT_TOKEN и chat id на сервере)
            </label>
            {editing?.id ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.is_completed}
                  onChange={(e) => {
                    const done = e.target.checked
                    completeEventMutation.mutate({ id: editing.id, done })
                    setEditing((prev) => (prev ? { ...prev, is_completed: done } : prev))
                  }}
                />
                Отметить выполненным
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="btn-primary"
                disabled={
                  !user?.organization_id ||
                  !formTitle.trim() ||
                  saveEventMutation.isPending ||
                  editing?.is_auto === true
                }
                onClick={() => saveEventMutation.mutate()}
              >
                {saveEventMutation.isPending ? 'Сохранение…' : 'Сохранить'}
              </button>
              {editing?.id && !editing.is_auto ? (
                <button type="button" className="btn-secondary text-rose-600" onClick={() => deleteEventMutation.mutate(editing.id)}>
                  Удалить
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                Закрыть
              </button>
            </div>
            {editing?.is_auto ? (
              <p className="text-xs text-on-surface-variant">Автособытие налогового календаря нельзя изменить или удалить; можно отметить выполненным.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <form id="planner-new-task" onSubmit={onCreateTask} className="card-elevated grid gap-3 p-6 md:grid-cols-2 scroll-mt-24">
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Новая задача планера</h2>
          {canRequestReport && (
            <div className="inline-flex rounded-xl border border-outline/70 p-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${taskKind === 'task' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                onClick={() => setTaskKind('task')}
              >
                Обычная задача
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${taskKind === 'report_request' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                onClick={() => {
                  setTaskKind('report_request')
                  if (!title.trim()) setTitle('Запрос отчёта:')
                }}
              >
                Запрос отчёта
              </button>
            </div>
          )}
        </div>
        <input
          className="input"
          placeholder={taskKind === 'report_request' ? 'Напр.: Покажи расходы по аренде за январь' : 'Напр.: Срочно оплатить счёт №123'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Назначить ответственного</option>
          {assignees.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.role})
            </option>
          ))}
        </select>
        <textarea
          className="input md:col-span-2 min-h-[90px]"
          placeholder={taskKind === 'report_request' ? 'Укажите период, детализацию и ожидаемый формат отчёта' : 'Описание и контекст задачи'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="input md:col-span-2"
          placeholder="Вложения (URL через запятую)"
          value={attachments}
          onChange={(e) => setAttachments(e.target.value)}
        />
        <button className="btn-primary md:col-span-2" type="submit" disabled={createTaskMutation.isPending}>
          Создать задачу
        </button>
      </form>

      <div className="card-elevated p-3">
        <div className="inline-flex rounded-xl border border-outline/70 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === 'mine' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            onClick={() => setViewMode('mine')}
          >
            Мои задачи ({(myTasksQuery.data ?? []).length})
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === 'assigned' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            onClick={() => setViewMode('assigned')}
          >
            Я ответственный ({(assignedTasksQuery.data ?? []).length})
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <TaskList
          title={viewMode === 'mine' ? 'Мои задачи' : 'Задачи, где я ответственный'}
          tasks={viewMode === 'mine' ? myTasksQuery.data ?? [] : assignedTasksQuery.data ?? []}
          loading={viewMode === 'mine' ? myTasksQuery.isLoading : assignedTasksQuery.isLoading}
          onClose={(id) => closeTaskMutation.mutate(id)}
          canClose
          userId={user?.id || ''}
          onReport={(taskId, content) => reportMutation.mutate({ taskId, content })}
          reportText={reportText}
          setReportText={setReportText}
          commentText={commentText}
          setCommentText={setCommentText}
          onComment={(taskId, content) => commentMutation.mutate({ taskId, content })}
        />
      </div>
    </OperationalPage>
  )
}

function TaskList(props: {
  title: string
  tasks: PlannerTask[]
  loading?: boolean
  canClose?: boolean
  onClose: (id: string) => void
  userId: string
  onReport: (taskId: string, content: string) => void
  reportText: Record<string, string>
  setReportText: Dispatch<SetStateAction<Record<string, string>>>
  commentText: Record<string, string>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  onComment: (taskId: string, content: string) => void
}) {
  const {
    title,
    tasks,
    loading,
    canClose,
    onClose,
    userId,
    onReport,
    reportText,
    setReportText,
    commentText,
    setCommentText,
    onComment,
  } = props
  return (
    <div className="card-elevated p-5">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Загрузка задач">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/40 px-4 py-6 text-center">
          <p className="text-sm text-on-surface-variant">Задач нет — создайте первую в форме выше.</p>
          <button
            type="button"
            className="btn-secondary mx-auto mt-4 min-h-10 px-5 text-sm"
            onClick={() => document.getElementById('planner-new-task')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            К форме создания
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canClose={canClose}
              onClose={onClose}
              userId={userId}
              onReport={onReport}
              reportText={reportText}
              setReportText={setReportText}
              commentText={commentText}
              setCommentText={setCommentText}
              onComment={onComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard(props: {
  task: PlannerTask
  canClose?: boolean
  onClose: (id: string) => void
  userId: string
  onReport: (taskId: string, content: string) => void
  reportText: Record<string, string>
  setReportText: Dispatch<SetStateAction<Record<string, string>>>
  commentText: Record<string, string>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  onComment: (taskId: string, content: string) => void
}) {
  const { task, canClose, onClose, userId, onReport, reportText, setReportText, commentText, setCommentText, onComment } = props
  const commentsQuery = useQuery({
    queryKey: ['planner-comments', task.id],
    queryFn: () => plannerApi.listComments(task.id).then((r) => r.data as PlannerComment[]),
  })
  return (
    <article className="rounded-xl border border-outline/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{task.title}</p>
          <p className="text-xs text-on-surface-variant">{task.description || 'Без описания'}</p>
        </div>
        <span className={`text-xs ${task.status === 'closed' ? 'text-emerald-600' : 'text-amber-600'}`}>{task.status}</span>
      </div>
      {task.status !== 'closed' && canClose && (
        <button className="btn-secondary mt-3 mr-2" onClick={() => onClose(task.id)}>
          Закрыть
        </button>
      )}
      <div className="mt-3 space-y-2 rounded-lg bg-surface-container-low/40 p-2">
        <p className="text-xs font-semibold text-on-surface-variant">Комментарии</p>
        <div className="space-y-1">
          {(commentsQuery.data || []).map((c) => (
            <div key={c.id} className="rounded-md border border-outline/40 px-2 py-1 text-xs">
              <p>{c.content}</p>
              <p className="text-on-surface-variant">{new Date(c.created_at).toLocaleString('ru-RU')}</p>
            </div>
          ))}
          {commentsQuery.data?.length === 0 && <p className="text-xs text-on-surface-variant">Пока нет комментариев</p>}
        </div>
        <div className="flex gap-2">
          <input
            className="input h-9 text-sm"
            placeholder="Добавить комментарий"
            value={commentText[task.id] || ''}
            onChange={(e) => setCommentText((prev) => ({ ...prev, [task.id]: e.target.value }))}
          />
          <button className="btn-secondary" onClick={() => onComment(task.id, commentText[task.id] || '')} disabled={!(commentText[task.id] || '').trim()}>
            Комментировать
          </button>
        </div>
      </div>
      {task.status !== 'closed' && (
        <div className="mt-3 space-y-2">
          <textarea
            className="input min-h-[70px]"
            placeholder="Подготовить отчёт..."
            value={reportText[task.id] || ''}
            onChange={(e) => setReportText((prev) => ({ ...prev, [task.id]: e.target.value }))}
          />
          <button
            className="btn-primary"
            onClick={() => onReport(task.id, reportText[task.id] || '')}
            disabled={!(reportText[task.id] || '').trim() || (task.assignee_id !== userId && task.author_id !== userId)}
          >
            Подготовить отчёт
          </button>
        </div>
      )}
    </article>
  )
}
