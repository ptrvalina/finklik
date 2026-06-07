import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, plannerApi, reportingCalmApi, taxApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { formatRelativeWhen, mergeUpcomingBusinessEvents, type BusinessCalendarEvent } from '../../lib/businessCalendar'
import { CALENDAR_BUCKET_LABEL, calendarBucket, type CalendarBucket } from '../../lib/dashboardOwnerMetrics'

const BUCKET_ORDER: CalendarBucket[] = ['today', 'week', 'month']

function groupEvents(events: BusinessCalendarEvent[]) {
  const groups: Record<CalendarBucket, BusinessCalendarEvent[]> = { today: [], week: [], month: [] }
  for (const ev of events) {
    const b = calendarBucket(ev.date)
    if (b) groups[b].push(ev)
  }
  return BUCKET_ORDER.filter((k) => groups[k].length > 0).map((k) => ({
    key: k,
    label: CALENDAR_BUCKET_LABEL[k],
    items: groups[k].slice(0, 3),
  }))
}

export default function DashboardCalendarCard() {
  const year = new Date().getFullYear()
  const today = new Date()
  const dateFrom = today.toISOString().slice(0, 10)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + 30)
  const dateTo = horizon.toISOString().slice(0, 10)

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
        maxDaysAhead: 30,
        limit: 12,
      }),
    [taxData, userEvents, reporting, plannerTasks],
  )

  const groups = useMemo(() => groupEvents(events), [events])
  const isLoading = taxLoading || calLoading || repLoading || tasksLoading

  return (
    <article className="fc-dashboard-card flex flex-col">
      <h2 className="fc-dashboard-card-title">Календарь</h2>

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
