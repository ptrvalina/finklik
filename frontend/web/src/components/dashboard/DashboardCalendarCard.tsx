import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, plannerApi, reportingCalmApi, taxApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { formatRelativeWhen, mergeUpcomingBusinessEvents, type BusinessCalendarEvent } from '../../lib/businessCalendar'
import { CALENDAR_BUCKET_LABEL, calendarBucket, type CalendarBucket } from '../../lib/dashboardOwnerMetrics'

type HorizonMode = 7 | 30 | 90

const HORIZON_OPTIONS: { id: HorizonMode; label: string }[] = [
  { id: 7, label: '7 дней' },
  { id: 30, label: '30 дней' },
  { id: 90, label: 'Квартал' },
]

const MAX_CALENDAR_DAYS = 140

const BUCKET_ORDER: CalendarBucket[] = ['today', 'week', 'month']

function groupEvents(events: BusinessCalendarEvent[], horizon: HorizonMode) {
  const groups: Record<CalendarBucket, BusinessCalendarEvent[]> = { today: [], week: [], month: [] }
  for (const ev of events) {
    const days = Math.round(
      (new Date(ev.date.slice(0, 10)).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
    )
    if (days > horizon || days > MAX_CALENDAR_DAYS) continue
    const b = calendarBucket(ev.date)
    if (b) groups[b].push(ev)
  }
  return BUCKET_ORDER.filter((k) => groups[k].length > 0).map((k) => ({
    key: k,
    label: CALENDAR_BUCKET_LABEL[k],
    items: groups[k].slice(0, horizon === 7 ? 2 : 3),
  }))
}

export default function DashboardCalendarCard() {
  const [horizon, setHorizon] = useState<HorizonMode>(30)
  const year = new Date().getFullYear()
  const today = new Date()
  const dateFrom = today.toISOString().slice(0, 10)
  const horizonDate = new Date(today)
  horizonDate.setDate(horizonDate.getDate() + Math.min(horizon, MAX_CALENDAR_DAYS))
  const dateTo = horizonDate.toISOString().slice(0, 10)

  const { data: taxData, isLoading: taxLoading } = useQuery({
    queryKey: orgQueryKey(['tax-calendar-home', year]),
    queryFn: () => taxApi.calendar(year).then((r) => r.data),
    staleTime: 120_000,
  })

  const { data: userEvents, isLoading: calLoading } = useQuery({
    queryKey: orgQueryKey(['calendar-home', dateFrom, dateTo]),
    queryFn: () => api.get(`/calendar/events?date_from=${dateFrom}&date_to=${dateTo}`).then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: reporting, isLoading: repLoading } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  const { data: plannerTasks, isLoading: tasksLoading } = useQuery({
    queryKey: orgQueryKey('planner-home-tasks'),
    queryFn: () => plannerApi.listTasks('all').then((r) => r.data),
    staleTime: 60_000,
  })

  const events = useMemo(
    () =>
      mergeUpcomingBusinessEvents({
        taxEvents: taxData?.events,
        userEvents,
        timeline: reporting?.timeline,
        obligations: reporting?.obligations_preview,
        tasks: plannerTasks,
        maxDaysAhead: Math.min(horizon, MAX_CALENDAR_DAYS),
        limit: 16,
      }),
    [taxData, userEvents, reporting, plannerTasks, horizon],
  )

  const groups = useMemo(() => groupEvents(events, horizon), [events, horizon])
  const isLoading = taxLoading || calLoading || repLoading || tasksLoading

  return (
    <article className="fc-dashboard-card flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="fc-dashboard-card-title">Календарь бизнеса</h2>
        <div className="flex gap-1 rounded-lg border border-outline/30 p-0.5">
          {HORIZON_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                horizon === opt.id
                  ? 'bg-primary text-primary-on'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              onClick={() => setHorizon(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="fc-skeleton-pulse mt-2 min-h-[100px] flex-1 rounded-lg" />
      ) : groups.length === 0 ? (
        <p className="mt-2 flex-1 text-sm text-on-surface-variant">Ближайших событий нет</p>
      ) : (
        <div className="mt-2 flex-1 space-y-2 overflow-hidden">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{g.label}</p>
              <ul className="mt-1 space-y-1">
                {g.items.map((ev) => (
                  <li key={ev.id}>
                    <Link to={ev.to} className="block truncate text-sm font-medium text-on-surface hover:text-primary">
                      <span className="text-on-surface-variant">{formatRelativeWhen(ev.date)} · </span>
                      {ev.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Link to="/calendar" className="btn-secondary fc-btn-thumb mt-3 w-full text-sm">
        Открыть календарь
      </Link>
    </article>
  )
}
