import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { plannerApi, reportingCalmApi, taxApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { mergeUpcomingBusinessEvents, type BusinessCalendarEvent } from '../../lib/businessCalendar'
import { formatRelativeWhen } from '../../lib/businessCalendar'
import MoneyAmount from '../ui/MoneyAmount'

const STATUS_LABEL: Record<string, string> = {
  overdue: 'Просрочено',
  due_soon: 'Скоро',
  pending: 'Ожидает',
  paid: 'Оплачено',
  submitted: 'Сдано',
}

function obligationStatus(ev: BusinessCalendarEvent): string {
  const days = Math.round(
    (new Date(ev.date.slice(0, 10)).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  )
  if (days < 0) return 'overdue'
  if (days <= 7) return 'due_soon'
  return 'pending'
}

/** Блок «Ближайшие обязательства» — налоги и отчёты на 30 дней (ТЗ §3). */
export default function DashboardObligationsCard() {
  const year = new Date().getFullYear()

  const { data: taxData, isLoading: taxLoading } = useQuery({
    queryKey: orgQueryKey(['tax-calendar-obligations', year]),
    queryFn: () => taxApi.calendar(year).then((r) => r.data),
    staleTime: 120_000,
  })

  const { data: reporting, isLoading: repLoading } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  const { data: plannerTasks, isLoading: tasksLoading } = useQuery({
    queryKey: orgQueryKey('planner-obligations'),
    queryFn: () => plannerApi.listTasks('all').then((r) => r.data),
    staleTime: 60_000,
  })

  const obligations = useMemo(() => {
    const all = mergeUpcomingBusinessEvents({
      taxEvents: taxData?.events,
      timeline: reporting?.timeline,
      obligations: reporting?.obligations_preview,
      tasks: plannerTasks,
      maxDaysAhead: 30,
      limit: 20,
    })
    return all
      .filter((e) => e.kind === 'tax' || e.kind === 'report' || e.kind === 'deadline')
      .slice(0, 5)
  }, [taxData, reporting, plannerTasks])

  const isLoading = taxLoading || repLoading || tasksLoading

  return (
    <article className="fc-dashboard-card flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h2 className="fc-dashboard-card-title">Ближайшие обязательства</h2>
        <span className="text-xs text-on-surface-variant">30 дней</span>
      </div>

      {isLoading ? (
        <div className="fc-skeleton-pulse mt-2 min-h-[120px] flex-1 rounded-lg" />
      ) : obligations.length === 0 ? (
        <p className="mt-3 flex-1 text-sm text-on-surface-variant">Нет обязательств на ближайший месяц</p>
      ) : (
        <ul className="mt-2 flex-1 divide-y divide-outline/15">
          {obligations.map((ev) => {
            const status = obligationStatus(ev)
            return (
              <li key={ev.id} className="py-2 first:pt-0">
                <Link to={ev.to} className="flex items-start justify-between gap-2 hover:text-primary">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{ev.title}</p>
                    <p className="text-xs text-on-surface-variant">{formatRelativeWhen(ev.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {ev.amount != null && Number(ev.amount) > 0 ? (
                      <MoneyAmount value={Number(ev.amount)} className="text-sm font-bold" />
                    ) : null}
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        status === 'overdue'
                          ? 'text-red-600'
                          : status === 'due_soon'
                            ? 'text-amber-600'
                            : 'text-on-surface-variant'
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Link to="/accounting/taxes" className="mt-2 text-sm font-semibold text-primary hover:underline">
        Все налоги и сроки →
      </Link>
    </article>
  )
}
