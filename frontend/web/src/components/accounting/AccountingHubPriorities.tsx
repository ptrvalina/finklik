import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'

type StateSlice = {
  document_completeness?: { needs_review?: number; pending_ocr?: number }
  compliance_state?: {
    pending_approvals?: number
    open_inbox_items?: number
    overdue_obligations?: number
  }
  reporting_status?: { status?: string; readiness_score?: number; blocker_codes?: string[] }
}

type PriorityRow = {
  id: string
  label: string
  count: number
  hint: string
  to: string
  tone: 'primary' | 'amber' | 'neutral'
}

function buildPriorities(state: StateSlice | undefined): PriorityRow[] {
  if (!state) return []
  const rows: PriorityRow[] = []
  const review = state.document_completeness?.needs_review ?? 0
  const pendingOcr = state.document_completeness?.pending_ocr ?? 0
  const approvals = state.compliance_state?.pending_approvals ?? 0
  const inbox = state.compliance_state?.open_inbox_items ?? 0
  const overdue = state.compliance_state?.overdue_obligations ?? 0
  const reporting = state.reporting_status?.status ?? ''
  const readiness = state.reporting_status?.readiness_score ?? 0

  if (review > 0) {
    rows.push({
      id: 'ocr-review',
      label: 'Документы на проверке',
      count: review,
      hint: 'Подтвердите поля перед проведением',
      to: '/scan',
      tone: 'primary',
    })
  }
  if (pendingOcr > 0) {
    rows.push({
      id: 'ocr-pending',
      label: 'В обработке распознавания',
      count: pendingOcr,
      hint: 'Дождитесь завершения или откройте сканер',
      to: '/scan',
      tone: 'neutral',
    })
  }
  if (approvals > 0) {
    rows.push({
      id: 'approvals',
      label: 'Согласования',
      count: approvals,
      hint: 'Решения фиксируются в аудите',
      to: '/approvals',
      tone: 'amber',
    })
  }
  if (inbox > 0) {
    rows.push({
      id: 'inbox',
      label: 'Входящие',
      count: inbox,
      hint: 'Запросы и поручения по организации',
      to: '/inbox',
      tone: 'amber',
    })
  }
  if (overdue > 0) {
    rows.push({
      id: 'overdue',
      label: 'Просроченные обязательства',
      count: overdue,
      hint: 'Влияет на готовность отчётности',
      to: '/reports',
      tone: 'amber',
    })
  }
  if (reporting === 'blocked' || reporting === 'at_risk' || readiness < 70) {
    rows.push({
      id: 'reporting',
      label: 'Готовность отчётности',
      count: Math.max(0, Math.round(100 - readiness)),
      hint:
        reporting === 'blocked'
          ? 'Есть блокеры — разберите в отчётности'
          : 'Доработайте данные до подачи',
      to: '/reports',
      tone: 'primary',
    })
  }
  return rows
}

function toneBorder(tone: PriorityRow['tone']) {
  if (tone === 'primary') return 'border-primary/30 bg-primary/[0.05]'
  if (tone === 'amber') return 'border-amber-400/30 bg-amber-500/[0.06]'
  return 'border-outline/35 bg-surface/90'
}

export default function AccountingHubPriorities() {
  const { data, isLoading, isError } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const state = data?.state as StateSlice | undefined
  const priorities = buildPriorities(state)

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-outline/25 bg-surface-container-low/50 p-6 min-h-[120px]" />
    )
  }

  if (isError) return null

  if (priorities.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-4">
        <p className="text-sm font-semibold text-on-surface">Очередь учёта пуста</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Можно вести журнал или загрузить первичку — система подскажет, когда появится работа.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/accounting/journal" className="btn-primary min-h-10 text-xs">
            Журнал
          </Link>
          <Link to="/scan" className="btn-secondary min-h-10 text-xs">
            Сканер
          </Link>
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Приоритеты учёта">
      <p className="fc-section-label mb-3">Что требует внимания</p>
      <ul className="space-y-2">
        {priorities.map((p) => (
          <li key={p.id}>
            <Link
              to={p.to}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition hover:shadow-sm ${toneBorder(p.tone)}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface">{p.label}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">{p.hint}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold tabular-nums text-on-surface">
                {p.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
