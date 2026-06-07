import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'

type BlockerRow = { id: string; label: string; to: string }

/** Компактная карточка «Требует внимания» — OCR, согласования, входящие. */
export default function DashboardAttentionCard() {
  const { data: fs, isLoading } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
  })

  const rows: BlockerRow[] = []
  const state = fs?.state as {
    document_completeness?: { pending_ocr?: number; needs_review?: number }
    compliance_state?: { pending_approvals?: number; open_inbox_items?: number }
  } | undefined

  const ocr = (state?.document_completeness?.pending_ocr ?? 0) + (state?.document_completeness?.needs_review ?? 0)
  if (ocr > 0) {
    rows.push({
      id: 'ocr',
      label: ocr === 1 ? 'Проверьте документ после сканирования' : `${ocr} документов ждут проверки`,
      to: '/scan',
    })
  }

  const approvals = state?.compliance_state?.pending_approvals ?? 0
  if (approvals > 0 && rows.length < 3) {
    rows.push({
      id: 'approvals',
      label: approvals === 1 ? 'Согласуйте расход' : `Согласуйте ${approvals} запросов`,
      to: '/inbox?tab=approvals',
    })
  }

  const inbox = state?.compliance_state?.open_inbox_items ?? 0
  if (inbox > 0 && rows.length < 3) {
    rows.push({
      id: 'inbox',
      label: inbox === 1 ? 'Ответьте на входящий запрос' : `${inbox} входящих без ответа`,
      to: '/inbox',
    })
  }

  const visible = rows.slice(0, 3)

  return (
    <article className="fc-dashboard-card flex flex-col">
      <h2 className="fc-dashboard-card-title">Требует внимания</h2>

      {isLoading ? (
        <div className="fc-skeleton-pulse mt-2 min-h-[100px] flex-1 rounded-lg" />
      ) : visible.length === 0 ? (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-3xl text-emerald-600 dark:text-emerald-400" aria-hidden>
            check_circle
          </span>
          <p className="mt-2 text-base font-semibold text-on-surface">Всё в порядке</p>
          <p className="text-sm text-on-surface-variant">Срочных задач нет</p>
        </div>
      ) : (
        <ul className="mt-2 flex-1 space-y-2">
          {visible.map((row) => (
            <li key={row.id}>
              <Link
                to={row.to}
                className="flex items-start gap-2 rounded-lg border border-outline/20 bg-surface-container-high/50 px-2.5 py-2 text-sm font-medium leading-snug text-on-surface transition hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-base text-amber-600 dark:text-amber-400" aria-hidden>
                  priority_high
                </span>
                {row.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
