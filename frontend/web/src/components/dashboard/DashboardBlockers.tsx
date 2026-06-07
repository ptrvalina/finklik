import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'

type BlockerRow = { id: string; label: string; to: string }

/** Блок «Требует внимания» — операционные препятствия простым языком. */
export default function DashboardBlockers() {
  const { data: fs, isLoading } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
  })

  const rows: BlockerRow[] = []
  const state = fs?.state as {
    document_completeness?: { pending_ocr?: number; needs_review?: number }
    compliance_state?: { pending_approvals?: number; open_inbox_items?: number; overdue_obligations?: number }
    reporting_status?: { status?: string; summary?: string }
  } | undefined

  const ocr = state?.document_completeness?.pending_ocr ?? 0
  if (ocr > 0) {
    rows.push({
      id: 'ocr',
      label: ocr === 1 ? 'Проверьте документ после распознавания' : `Проверьте ${ocr} документов после распознавания`,
      to: '/scan',
    })
  }

  const review = state?.document_completeness?.needs_review ?? 0
  if (review > 0 && rows.length < 5) {
    rows.push({
      id: 'review',
      label: review === 1 ? '1 документ ждёт вашего решения' : `${review} документов ждут вашего решения`,
      to: '/scan',
    })
  }

  const approvals = state?.compliance_state?.pending_approvals ?? 0
  if (approvals > 0 && rows.length < 5) {
    rows.push({
      id: 'approvals',
      label: approvals === 1 ? 'Согласуйте 1 расход' : `Согласуйте ${approvals} запросов на расход`,
      to: '/inbox?tab=approvals',
    })
  }

  const inbox = state?.compliance_state?.open_inbox_items ?? 0
  if (inbox > 0 && rows.length < 5) {
    rows.push({
      id: 'inbox',
      label: inbox === 1 ? 'Ответьте на 1 входящий запрос' : `Ответьте на ${inbox} входящих запросов`,
      to: '/inbox',
    })
  }

  const overdue = state?.compliance_state?.overdue_obligations ?? 0
  if (overdue > 0 && rows.length < 5) {
    rows.push({
      id: 'overdue',
      label: overdue === 1 ? 'Просрочен срок отчёта или платежа' : `Просрочено обязательств: ${overdue}`,
      to: '/reports',
    })
  }

  const rs = state?.reporting_status
  if (rs && ['blocked', 'at_risk'].includes(rs.status ?? '') && rows.length < 5) {
    rows.push({
      id: 'reporting',
      label: rs.summary || 'Подготовьте отчётность перед сроком сдачи',
      to: '/reports',
    })
  } else if (rs?.status === 'preparing' && rows.length < 5 && (state?.document_completeness?.pending_ocr ?? 0) === 0) {
    const summary = rs.summary
    if (summary && !summary.includes('спокойной')) {
      rows.push({
        id: 'reporting-prep',
        label: summary,
        to: '/reports',
      })
    }
  }

  if (isLoading) {
    return <div className="fc-skeleton-pulse h-12 rounded-xl" />
  }

  if (rows.length === 0) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-outline/25 bg-surface px-3.5 py-2.5">
        <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400" aria-hidden>
          check_circle
        </span>
        <p className="text-sm text-on-surface-variant">
          <span className="font-semibold text-on-surface">Требует внимания:</span> всё в порядке
        </p>
      </section>
    )
  }

  const visible = rows.slice(0, 4)

  return (
    <section className="rounded-xl border border-outline/30 bg-surface p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Требует внимания</p>
      <ul className="mt-2 space-y-1.5">
        {visible.map((row) => (
          <li key={row.id}>
            <Link
              to={row.to}
              className="flex items-center gap-2 rounded-lg border border-outline/20 bg-surface-container-high/60 px-3 py-2 text-sm font-medium text-on-surface transition hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="material-symbols-outlined text-base text-amber-700 dark:text-amber-400" aria-hidden>
                error_outline
              </span>
              {row.label}
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > 4 && (
        <Link to="/operations" className="mt-2 inline-flex text-xs font-semibold text-primary">
          Ещё {rows.length - 4} →
        </Link>
      )}
    </section>
  )
}
