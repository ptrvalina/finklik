import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { operationsApi } from '../api/client'
import { GlassCard } from '../components/premium/GlassCard'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'

type OperationalItem = {
  id: string
  type: string
  priority: string
  status: string
  entity_id: string
  title: string
  context?: string | null
  action_path?: string | null
  ai_why?: string | null
  state_dimension?: string | null
  state_transition_hint?: string | null
}

type FinancialStateBlock = {
  cashflow_state: { level: string; monthly_net: string; health_signal: string; summary: string }
  operational_readiness: { score: number; confidence: string; label: string }
  compliance_state: {
    level: string
    pending_approvals: number
    overdue_obligations: number
    open_inbox_items: number
    summary: string
  }
  document_completeness: {
    score: number
    pending_ocr: number
    needs_review: number
    low_confidence_unconfirmed: number
    summary: string
  }
  reporting_status: { status: string; readiness_score: number; blocker_codes: string[]; summary: string }
  risk_level: string
  derived_at: string
}

type StatePrediction = {
  id: string
  horizon_days: number
  message: string
  affected_dimension: string
  severity: string
}

type WorkPack = {
  id: string
  title: string
  mode: string
  summary_lines: Array<{ kind: string; count: number; detail?: string | null }>
  operational_item_ids: string[]
  recommended_action: string
  expected_outcome: string
  risk_if_ignored: string
  primary_action_path: string | null
}

type ExecutionFeedResponse = {
  items: OperationalItem[]
  top_action: OperationalItem | null
  pending_count: number
  blocked_count: number
  readiness_score: number | null
  ai_summary: string | null
  financial_state: FinancialStateBlock | null
  work_packs: WorkPack[]
  state_predictions: StatePrediction[]
  default_autonomy_mode: string
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

const STATE_DIM_RU: Record<string, string> = {
  cashflow_state: 'Касса',
  operational_readiness: 'Готовность',
  compliance_state: 'Комплаенс',
  document_completeness: 'Документы',
  reporting_status: 'Отчётность',
}

const AUTONOMY_RU: Record<string, string> = {
  observe: 'наблюдение',
  suggest: 'подсказки',
  prepare: 'подготовка',
  execute_with_approval: 'исполнение с подтверждением',
}

function priorityStyles(p: string) {
  switch (p) {
    case 'critical':
      return 'bg-red-500/15 text-red-200 ring-red-400/30'
    case 'high':
      return 'bg-amber-500/12 text-amber-100 ring-amber-400/25'
    case 'medium':
      return 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/20'
    default:
      return 'bg-white/8 text-white/70 ring-white/10'
  }
}

function typeIcon(t: string) {
  switch (t) {
    case 'transaction':
      return 'menu_book'
    case 'document':
      return 'document_scanner'
    case 'approval':
      return 'verified_user'
    case 'reporting':
      return 'assignment_turned_in'
    case 'reconciliation':
      return 'compare_arrows'
    default:
      return 'task_alt'
  }
}

function FeedRow({
  item,
  onOpen,
  prominent,
}: {
  item: OperationalItem
  onOpen: (path: string | null | undefined) => void
  prominent?: boolean
}) {
  const touch = useRef({ x: 0, y: 0 })

  const go = useCallback(() => onOpen(item.action_path), [item.action_path, onOpen])

  return (
    <GlassCard
      variant="subtle"
      hoverLift={false}
      className={`p-4 sm:p-5 ${prominent ? 'ring-1 ring-primary/35' : ''}`}
      onClick={() => go()}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0]
        const dx = t.clientX - touch.current.x
        const dy = Math.abs(t.clientY - touch.current.y)
        if (dx > 70 && dy < 40 && item.action_path) {
          go()
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-primary/90"
          aria-hidden
        >
          {typeIcon(item.type)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityStyles(item.priority)}`}
            >
              {PRIORITY_LABEL[item.priority] || item.priority}
            </span>
            {item.state_dimension && (
              <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-on-surface-variant">
                {STATE_DIM_RU[item.state_dimension] || item.state_dimension}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wide text-on-surface-variant">
              {item.type}
            </span>
          </div>
          <p className="mt-1.5 font-headline text-[15px] font-semibold leading-snug text-on-surface">
            {item.title}
          </p>
          {item.context && (
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{item.context}</p>
          )}
          {item.ai_why && (
            <p className="mt-2 rounded-2xl border border-outline/40 bg-surface-container-low/60 px-3 py-2 text-xs leading-relaxed text-on-surface-variant dark:bg-white/[0.03]">
              <span className="font-semibold text-primary/90">Зачем это важно: </span>
              {item.ai_why}
            </p>
          )}
          {item.state_transition_hint && (
            <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/90">
              <span className="font-medium text-on-surface/90">Состояние: </span>
              {item.state_transition_hint}
            </p>
          )}
          {item.action_path && prominent && (
            <p className="mt-2 text-[11px] text-on-surface-variant/80">
              Нажмите карточку или свайпните вправо — откроется нужный раздел.
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

export default function OperationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [panelItem, setPanelItem] = useState<OperationalItem | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['operations', 'execution-feed'],
    queryFn: () => operationsApi.executionFeed().then((r) => r.data as ExecutionFeedResponse),
  })

  const ackPack = useMutation({
    mutationFn: (packId: string) => operationsApi.ackWorkPack(packId).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['operations', 'execution-feed'] }),
  })

  const openPath = useCallback(
    (path: string | null | undefined) => {
      if (!path) return
      void qc.invalidateQueries({ queryKey: ['operations', 'execution-feed'] })
      navigate(path)
    },
    [navigate, qc],
  )

  const items = data?.items ?? []
  const top = data?.top_action
  const rest = top ? items.filter((i) => i.id !== top.id) : items
  const next = rest[0] ?? null

  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pb-10 sm:pt-10">
      {/* Мобильный state-dashboard: риск + готовность + следующий микро-шаг */}
      {!isLoading && !isError && data?.financial_state && (
        <div className="fixed inset-x-0 top-0 z-20 border-b border-outline/30 bg-[rgb(var(--color-surface)/0.92)] px-3 py-2 shadow-sm backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 text-[11px] text-on-surface">
            <span>
              Риск: <strong className="text-on-surface">{data.financial_state.risk_level}</strong>
            </span>
            <span>
              Готовн.: <strong>{data.financial_state.operational_readiness.score}%</strong>
            </span>
            {data.state_predictions?.[0] && (
              <span className="line-clamp-1 min-w-0 text-on-surface-variant" title={data.state_predictions[0].message}>
                {data.state_predictions[0].message}
              </span>
            )}
          </div>
        </div>
      )}

      <header className={`mb-8 ${!isLoading && !isError && data?.financial_state ? 'mt-10 sm:mt-0' : ''}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Исполнение</p>
        <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
          Что сделать сегодня
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
          Лента отражает единое финансовое состояние: сначала снимок, затем пакеты подготовки и сигналы, что
          изменить в первую очередь.
        </p>
      </header>

      {!isLoading && !isError && data?.financial_state && (
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Состояние (каноническая модель)
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-on-surface-variant">Касса / cashflow_state</p>
              <p className="mt-0.5 font-medium text-on-surface">
                {data.financial_state.cashflow_state.level} · нетто месяца{' '}
                {Number(data.financial_state.cashflow_state.monthly_net).toLocaleString('ru-BY', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                · {data.financial_state.cashflow_state.summary}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Готовность / operational_readiness</p>
              <p className="mt-0.5 font-medium text-on-surface">
                {data.financial_state.operational_readiness.score}% ({data.financial_state.operational_readiness.confidence})
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Комплаенс / compliance_state</p>
              <p className="mt-0.5 font-medium text-on-surface">
                {data.financial_state.compliance_state.level} — {data.financial_state.compliance_state.summary}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Первичка / document_completeness</p>
              <p className="mt-0.5 font-medium text-on-surface">
                {data.financial_state.document_completeness.score}% — очередь OCR {data.financial_state.document_completeness.pending_ocr}, на
                проверке {data.financial_state.document_completeness.needs_review}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Отчётность / reporting_status</p>
              <p className="mt-0.5 font-medium text-on-surface">
                {data.financial_state.reporting_status.status} ({data.financial_state.reporting_status.readiness_score}%)
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Риск</p>
              <p className="mt-0.5 font-semibold text-on-surface">{data.financial_state.risk_level}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-on-surface-variant">
            Автономность ИИ:{' '}
            <strong className="text-on-surface">
              {AUTONOMY_RU[data.default_autonomy_mode] || data.default_autonomy_mode}
            </strong>{' '}
            — подготовка без массового автопроведения.
          </p>
        </GlassCard>
      )}

      {!isLoading && !isError && (data?.state_predictions?.length ?? 0) > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Прогноз состояния
          </p>
          {(data?.state_predictions ?? []).map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                p.severity === 'risk'
                  ? 'border-red-400/25 bg-red-500/[0.06]'
                  : 'border-outline/40 bg-surface-container-low/60 dark:bg-white/[0.03]'
              }`}
            >
              <span className="text-on-surface-variant">
                ~{p.horizon_days} дн. · {STATE_DIM_RU[p.affected_dimension] || p.affected_dimension}:{' '}
              </span>
              {p.message}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && (data?.work_packs?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Пакеты подготовки (Work Pack)
          </h2>
          <div className="grid gap-4">
            {(data?.work_packs ?? []).map((pack) => (
              <GlassCard key={pack.id} variant="subtle" className="p-5" hoverLift={false}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-headline text-base font-semibold text-on-surface">{pack.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-on-surface-variant">
                      Режим: {AUTONOMY_RU[pack.mode] || pack.mode}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 list-inside list-disc text-sm text-on-surface-variant">
                  {pack.summary_lines.map((ln, i) => (
                    <li key={i}>
                      {ln.count} × {ln.detail || ln.kind}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-on-surface">{pack.recommended_action}</p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  <span className="font-medium text-on-surface/90">Ожидаемый эффект: </span>
                  {pack.expected_outcome}
                </p>
                <p className="mt-1 text-xs text-amber-100/90">
                  <span className="font-medium">Если игнорировать: </span>
                  {pack.risk_if_ignored}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ackPack.isPending}
                    onClick={() => ackPack.mutate(pack.id)}
                    className="rounded-2xl border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    Принять к работе
                  </button>
                  <button
                    type="button"
                    onClick={() => pack.primary_action_path && openPath(pack.primary_action_path)}
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-on hover:opacity-95"
                  >
                    Открыть раздел
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {data?.readiness_score != null && (
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-outline/40 bg-surface/80 px-3 py-1 text-on-surface">
            Готовность <strong>{data.readiness_score}%</strong>
          </span>
          <span className="rounded-full border border-outline/40 bg-surface/80 px-3 py-1 text-on-surface">
            В очереди <strong>{data.pending_count}</strong>
          </span>
          <span className="rounded-full border border-outline/40 bg-surface/80 px-3 py-1 text-on-surface">
            Блокеры <strong>{data.blocked_count}</strong>
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full border border-primary/35 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            Обновить
          </button>
        </div>
      )}

      {data?.ai_summary && (
        <p className="mb-8 rounded-3xl border border-outline/35 bg-surface-container-low/70 px-4 py-3 text-sm leading-relaxed text-on-surface-variant dark:bg-white/[0.04]">
          {data.ai_summary}
        </p>
      )}

      {isLoading && (
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {isError && (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-500/[0.06] px-5 py-4 text-sm text-on-surface">
          Не удалось загрузить ленту исполнения. Проверьте доступ к организации и попробуйте снова.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <PremiumEmptyState
          icon="task_alt"
          title="Нет открытых операций"
          description="Все ключевые проверки пройдены — можно заниматься стратегией или следующим периодом."
        />
      )}

      {!isLoading && !isError && top && (
        <section className="mb-8">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Главное действие
          </h2>
          <FeedRow item={top} onOpen={openPath} prominent />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => top.action_path && openPath(top.action_path)}
              className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-on hover:opacity-95"
            >
              Перейти к выполнению
            </button>
            <button
              type="button"
              onClick={() => setPanelItem(top)}
              className="rounded-2xl border border-outline/45 px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-white/5"
            >
              Контекст
            </button>
          </div>
        </section>
      )}

      {!isLoading && !isError && rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Дальше по важности ({rest.length})
          </h2>
          <div className="grid gap-3">
            {rest.map((item) => (
              <FeedRow key={item.id} item={item} onOpen={openPath} />
            ))}
          </div>
        </section>
      )}

      {isFetching && !isLoading && (
        <p className="mt-6 text-center text-xs text-on-surface-variant">Обновление…</p>
      )}

      {/* Sticky mobile assistant: следующий шаг */}
      {next && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 px-3 sm:hidden">
          <button
            type="button"
            onClick={() => next.action_path && openPath(next.action_path)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/35 bg-[rgb(var(--color-surface)/0.92)] px-4 py-3 text-left shadow-float backdrop-blur-xl dark:bg-[rgb(var(--color-surface)/0.88)]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Следующее</p>
              <p className="truncate text-sm font-semibold text-on-surface">{next.title}</p>
            </div>
            <span className="material-symbols-outlined shrink-0 text-primary">arrow_forward</span>
          </button>
        </div>
      )}

      {/* Контекст-панель (без чата — только пояснение) */}
      {panelItem && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          aria-label="Закрыть панель"
          onClick={() => setPanelItem(null)}
        >
          <span className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 block max-h-[55vh] overflow-y-auto rounded-3xl border border-outline/40 bg-surface p-5 text-left shadow-float dark:bg-[rgb(var(--color-surface)/0.96)]">
            <span
              role="presentation"
              className="block"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-headline text-lg font-semibold text-on-surface">{panelItem.title}</h3>
                <button
                  type="button"
                  className="rounded-full p-1 text-on-surface-variant hover:bg-white/10"
                  onClick={() => setPanelItem(null)}
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
              {panelItem.context && (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{panelItem.context}</p>
              )}
              {panelItem.ai_why && (
                <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
                  <strong className="text-on-surface">Важность:</strong> {panelItem.ai_why}
                </p>
              )}
              {panelItem.state_transition_hint && (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  <strong className="text-on-surface">Состояние:</strong> {panelItem.state_transition_hint}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {panelItem.action_path && (
                  <button
                    type="button"
                    className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-on"
                    onClick={() => {
                      setPanelItem(null)
                      openPath(panelItem.action_path)
                    }}
                  >
                    Открыть раздел
                  </button>
                )}
                <Link
                  to="/reports"
                  className="rounded-2xl border border-outline/45 px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-white/5"
                  onClick={() => setPanelItem(null)}
                >
                  Отчётность
                </Link>
              </div>
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
