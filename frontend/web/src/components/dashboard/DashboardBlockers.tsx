import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'

type BlockerRow = { id: string; label: string; to: string }

/** Блок 3 главной: операционные препятствия (отчётность — в ReportingReadinessHero). */
export default function DashboardBlockers() {
  const { data: fs } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
  })

  const rows: BlockerRow[] = []
  const state = fs?.state as {
    document_completeness?: { pending_ocr?: number; needs_review?: number }
    compliance_state?: { pending_approvals?: number; open_inbox_items?: number }
  } | undefined

  const ocr = state?.document_completeness?.pending_ocr ?? 0
  if (ocr > 0) {
    rows.push({
      id: 'ocr',
      label: ocr === 1 ? 'Проверить 1 документ после распознавания' : `Проверить ${ocr} документов после распознавания`,
      to: '/scan',
    })
  }

  const approvals = state?.compliance_state?.pending_approvals ?? 0
  if (approvals > 0 && rows.length < 4) {
    rows.push({
      id: 'approvals',
      label: approvals === 1 ? 'Согласовать 1 расход' : `Согласовать ${approvals} запросов`,
      to: '/inbox?tab=approvals',
    })
  }

  const inbox = state?.compliance_state?.open_inbox_items ?? 0
  if (inbox > 0 && rows.length < 4) {
    rows.push({
      id: 'inbox',
      label: inbox === 1 ? 'Ответить на 1 входящий запрос' : `Ответить на ${inbox} входящих`,
      to: '/inbox',
    })
  }

  if (rows.length === 0) {
    return (
      <section className="glass-card rounded-2xl p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Что мешает</p>
        <p className="mt-2 text-sm text-on-surface-variant">Ничего не блокирует — можно двигаться дальше.</p>
      </section>
    )
  }

  const visible = rows.slice(0, 3)

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Что мешает</p>
      <ul className="mt-3 space-y-2">
        {visible.map((row) => (
          <li key={row.id}>
            <Link
              to={row.to}
              className="flex items-center gap-2 rounded-xl border border-outline/25 bg-surface-container-high/80 px-3 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="material-symbols-outlined text-lg text-amber-700 dark:text-amber-400" aria-hidden>
                error_outline
              </span>
              {row.label}
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > 3 && (
        <Link to="/operations" className="mt-3 inline-flex text-xs font-semibold text-primary">
          Ещё {rows.length - 3} в задачах →
        </Link>
      )}
    </section>
  )
}
