import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, reportingCalmApi, taxApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { formatMoney } from '../../lib/formatMoney'
import { formatRelativeWhen, mergeUpcomingBusinessEvents } from '../../lib/businessCalendar'

export default function DashboardBusinessCalendar() {
  const year = new Date().getFullYear()
  const today = new Date()
  const dateFrom = today.toISOString().slice(0, 10)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + 90)
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

  const events = useMemo(
    () =>
      mergeUpcomingBusinessEvents({
        taxEvents: taxData?.events,
        userEvents,
        timeline: reporting?.timeline,
        obligations: reporting?.obligations_preview,
        limit: 7,
      }),
    [taxData, userEvents, reporting],
  )

  const isLoading = taxLoading || calLoading || repLoading

  if (isLoading) {
    return <div className="fc-skeleton-pulse h-36 rounded-xl" />
  }

  return (
    <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Календарь бизнеса</p>
        <Link to="/calendar" className="text-xs font-semibold text-primary hover:underline">
          Весь календарь
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Ближайших событий нет</p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link
                to={ev.to}
                className="flex items-start gap-3 rounded-lg border border-outline/15 bg-surface-container-high/50 px-3 py-2 transition hover:border-primary/25 hover:bg-primary/5"
              >
                <span className="w-[7.5rem] shrink-0 text-xs font-bold text-primary">{formatRelativeWhen(ev.date)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-on-surface">{ev.title}</p>
                  {(ev.subtitle || ev.amount != null) && (
                    <p className="text-xs text-on-surface-variant">
                      {[ev.subtitle, ev.amount != null ? formatMoney(ev.amount) : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="material-symbols-outlined shrink-0 text-base text-on-surface-variant/60" aria-hidden>
                  chevron_right
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
