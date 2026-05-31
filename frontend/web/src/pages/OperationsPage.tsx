import { memo, useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { operationsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { GlassCard } from '../components/premium/GlassCard'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import GroupedExecutionFeed from '../components/operations/GroupedExecutionFeed'
import OperationsProgressStrip from '../components/operations/OperationsProgressStrip'
import { WorkPackCard } from '../components/operations/WorkPackCard'
import { orgQueryKey } from '../lib/queryKeys'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import { executionRiskIfIgnored } from '../lib/executionPresentation'
import { markOperationsSeen } from '../lib/pilotProgress'
import { useOperational } from '../context/OperationalContext'
import { autonomyModeLabel, trustLevelLabel } from '../i18n/apiLabels.ru'
import { terminology } from '../i18n/terminology.ru'

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
  governance_tags?: string[]
  truth_confidence?: number | null
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

type TruthGovernance = {
  governance_version: string
  state_confidence: number
  frozen_dimensions: string[]
  mutation_level_by_dimension: Record<string, string>
  conflicts: Array<{ id: string; severity: string; title: string; detail: string; affected_dimensions: string[] }>
  governance_violations: string[]
  rules_catalog: Array<{ state_field: string; allowed_sources: string[]; validation_rule: string; priority: number }>
}

type StateAuditEntry = {
  id: string
  previous_state_summary?: string | null
  new_state_summary?: string | null
  trigger_event: string
  source: string
  actor: string
  timestamp: string
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
  progress_pct?: number | null
  tasks_done?: number | null
  tasks_total?: number | null
  eta_minutes?: number | null
  blocked_reason?: string | null
  acknowledged?: boolean
}

type ExperienceMode = 'solo' | 'operator' | 'accountant' | 'advanced'
type FeedDensity = 'minimal' | 'standard' | 'full'

type ProgressiveExperienceMeta = {
  mode: ExperienceMode
  feed_density: FeedDensity
  simplified_state?: {
    headline: string
    supporting_line?: string | null
    readiness_plain?: string | null
  } | null
  primary_focus_hint?: string | null
}

type OperationalHealthScore = {
  readiness: number
  consistency: number
  liquidity: number
  reporting_stability: number
  operational_load: number
  automation_stability: number
  composite: number
  summary_plain: string
}

type TrustedAutomationProfile = {
  trust_level: string
  legacy_ai_action_mode: string
  allowed_auto_actions: string[]
  always_require_confirmation: string[]
  rationale_plain: string
}

type WorkflowMaintenanceSuggestion = {
  id: string
  kind: string
  title: string
  detail: string
}

type CalmUiBudget = {
  max_visible_alerts: number
  max_parallel_priorities: number
  dominant_next_action_enforced: boolean
}

type TrustSurfaceResponse = {
  trust_lines: string[]
  background_jobs: Array<{
    id: string
    domain: string
    status_plain: string
    last_success_at?: string | null
    last_attempt_at?: string | null
    retry_count: number
    duration_hint_plain?: string | null
    failure_reason_plain?: string | null
  }>
  state_consistency?: {
    snapshot_aligned_with_audit: boolean
    message_plain: string
    stale_hint_plain?: string | null
  } | null
  operational_confidence: {
    level: string
    headline: string
    supporting_line?: string | null
  }
  safe_actions: {
    undo_window_hint: string
    confirmation_hint: string
    audit_reference_hint: string
    rollback_hint: string
  }
  backup_recovery: {
    snapshot_export_ready: boolean
    restore_boundary_note: string
    migration_safety_note: string
  }
  state_etag?: string | null
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
  truth_governance: TruthGovernance | null
  recent_state_audit: StateAuditEntry[]
  progressive_experience?: ProgressiveExperienceMeta | null
  operational_health?: OperationalHealthScore | null
  trusted_automation?: TrustedAutomationProfile | null
  workflow_maintenance?: WorkflowMaintenanceSuggestion[]
  operational_memory_hints?: string[]
  calm_ui_budget?: CalmUiBudget
}

const HealthMeter = memo(function HealthMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between gap-2 text-[10px] text-on-surface-variant">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/70 to-secondary/80"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
})

const MODE_LABEL: Record<ExperienceMode, string> = {
  solo: 'Спокойный режим',
  operator: 'Оператор',
  accountant: 'Бухгалтер / несколько клиентов',
  advanced: 'Расширенный',
}

export default function OperationsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.organization_id ?? '')
  const { recordWorkPack, setNextStep } = useOperational()
  const [panelItem, setPanelItem] = useState<OperationalItem | null>(null)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('trust') === '1') setDiagnosticsOpen(true)
  }, [searchParams])

  useEffect(() => {
    markOperationsSeen()
  }, [])

  const executionFeedKey = orgQueryKey('execution-feed')

  const { data, isLoading, isError, error: feedError, refetch, isFetching } = useQuery({
    queryKey: executionFeedKey,
    queryFn: () => operationsApi.executionFeed().then((r) => r.data as ExecutionFeedResponse),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
    enabled: !!orgId,
  })

  const { data: trustData } = useQuery({
    queryKey: orgQueryKey('trust-surface'),
    queryFn: () => operationsApi.trustSurface().then((r) => r.data as TrustSurfaceResponse),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    enabled: !!orgId,
  })

  const ackPack = useMutation({
    mutationFn: (packId: string) => operationsApi.ackWorkPack(packId).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: executionFeedKey, exact: true }),
  })

  const openPath = useCallback(
    (path: string | null | undefined) => {
      if (!path) return
      navigate(path)
    },
    [navigate],
  )

  const items = data?.items ?? []
  const top = data?.top_action
  const rest = top ? items.filter((i) => i.id !== top.id) : items
  const next = rest[0] ?? null

  const pe = data?.progressive_experience
  const mode = pe?.mode ?? 'operator'
  const feedCompact = pe?.feed_density === 'minimal'
  const simplified = pe?.simplified_state
  const showTechnicalStateByDefault = mode === 'advanced'
  const showDiagnostics = showTechnicalStateByDefault || diagnosticsOpen
  const workPackCount = data?.work_packs?.length ?? 0

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric mx-auto max-w-3xl pb-28 sm:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {mode !== 'advanced' && (
          <button
            type="button"
            className="btn-ghost min-h-10 text-xs font-semibold text-primary"
            onClick={() => setDiagnosticsOpen((v) => !v)}
          >
            {diagnosticsOpen ? 'Скрыть диагностику' : 'Диагностика'}
          </button>
        )}
        <Link to="/inbox" className="btn-secondary text-sm">
          Входящие
        </Link>
        <Link to="/approvals" className="btn-secondary text-sm">
          Согласования
        </Link>
      </div>

      {!isLoading && !isError && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Готовность</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
              {data?.readiness_score ?? '—'}%
            </p>
            <p className="text-[11px] text-primary">{MODE_LABEL[mode]}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">В очереди</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
              {data?.pending_count ?? items.length}
            </p>
            <p className="text-[11px] text-on-surface-variant">Задач</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Блокеры</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-error sm:text-2xl">
              {data?.blocked_count ?? 0}
            </p>
            <p className="text-[11px] text-on-surface-variant">Требуют внимания</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Пакеты</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-primary sm:text-2xl">
              {workPackCount}
            </p>
            <p className="text-[11px] text-on-surface-variant">Пакеты работ</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && simplified && (mode === 'solo' || mode === 'operator') && (
        <div className="fixed inset-x-0 top-0 z-20 border-b border-outline/30 bg-[rgb(var(--color-surface)/0.92)] px-3 py-2 shadow-sm backdrop-blur-md sm:hidden">
          <p className="mx-auto max-w-3xl line-clamp-2 text-[11px] font-medium leading-snug text-on-surface">
            {simplified.headline}
          </p>
        </div>
      )}

      <div className={!isLoading && !isError && simplified && (mode === 'solo' || mode === 'operator') ? 'mt-8 sm:mt-0' : ''}>
      {!isLoading && !isError && (
        <div className="mb-6">
          <FinancialStateHero compact />
        </div>
      )}
      {!isLoading && !isError && trustData && showDiagnostics && (
        <details className="mb-6 rounded-3xl border border-outline/30 bg-surface-container-low/40 px-4 py-3 text-sm dark:bg-white/[0.03]">
          <summary className="cursor-pointer font-medium text-on-surface/90">
            Надёжность и фоновые процессы
          </summary>
          <div className="mt-3 space-y-4 text-on-surface-variant">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Спокойные индикаторы</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
                {trustData.trust_lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Фон</p>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed">
                {trustData.background_jobs.map((j) => (
                  <li key={j.id}>
                    <span className="text-on-surface/90">{j.domain}</span> — {j.status_plain}
                    {j.failure_reason_plain ? (
                      <span className="block text-amber-100/90">{j.failure_reason_plain}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            {trustData.state_consistency && (
              <p className="text-xs leading-relaxed">
                <span className="font-medium text-on-surface/90">Согласованность: </span>
                {trustData.state_consistency.message_plain}
                {trustData.state_consistency.stale_hint_plain
                  ? ` ${trustData.state_consistency.stale_hint_plain}`
                  : ''}
              </p>
            )}
            <div>
              <p className="text-xs font-semibold text-on-surface/90">{trustData.operational_confidence.headline}</p>
              {trustData.operational_confidence.supporting_line && (
                <p className="mt-1 text-xs">{trustData.operational_confidence.supporting_line}</p>
              )}
            </div>
            <details className="rounded-2xl border border-outline/25 bg-surface/50 px-3 py-2 text-[11px] dark:bg-white/[0.02]">
              <summary className="cursor-pointer font-medium text-on-surface/85">Как устроены безопасные действия</summary>
              <ul className="mt-2 space-y-1">
                <li>{trustData.safe_actions.confirmation_hint}</li>
                <li>{trustData.safe_actions.audit_reference_hint}</li>
                <li>{trustData.safe_actions.undo_window_hint}</li>
                <li>{trustData.safe_actions.rollback_hint}</li>
              </ul>
            </details>
          </div>
        </details>
      )}

      {!isLoading && !isError && pe?.primary_focus_hint && !top && (
        <GlassCard variant="subtle" className="mb-6 border-primary/25 p-5 ring-1 ring-primary/15" hoverLift={false}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Главный фокус</p>
          <p className="mt-2 text-base font-medium leading-snug text-on-surface">{pe.primary_focus_hint}</p>
        </GlassCard>
      )}

      {!isLoading && !isError && data?.readiness_score != null && (
        <div className="mb-6">
          <OperationsProgressStrip
            readinessScore={data.readiness_score}
            pendingCount={data.pending_count}
            blockedCount={data.blocked_count}
            onRefresh={() => void refetch()}
            refreshing={isFetching}
          />
        </div>
      )}

      {!isLoading && !isError && simplified && (mode === 'solo' || mode === 'operator' || mode === 'accountant') && (
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Как выглядит ситуация
          </p>
          <p className="mt-3 text-base font-medium leading-relaxed text-on-surface">{simplified.headline}</p>
          {simplified.supporting_line && (
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{simplified.supporting_line}</p>
          )}
          {simplified.readiness_plain && (
            <p className="mt-3 text-sm text-on-surface-variant">{simplified.readiness_plain}</p>
          )}
        </GlassCard>
      )}

      {!isLoading && !isError && showDiagnostics && data?.operational_health && (
        <div className="glass-card mb-6 rounded-2xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {terminology.execution.processSummary}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-on-surface">{data.operational_health.summary_plain}</p>
            </div>
            <div className="rounded-2xl bg-primary/15 px-3 py-2 text-center ring-1 ring-primary/25">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Индекс</p>
              <p className="font-headline text-2xl font-bold tabular-nums text-on-surface">
                {data.operational_health.composite}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <HealthMeter label="Готовность процессов" value={data.operational_health.readiness} />
            <HealthMeter label="Согласованность данных" value={data.operational_health.consistency} />
            <HealthMeter label="Ликвидность" value={data.operational_health.liquidity} />
            <HealthMeter label="Стабильность отчётности" value={data.operational_health.reporting_stability} />
            <HealthMeter label="Управляемость нагрузки" value={data.operational_health.operational_load} />
            <HealthMeter label="Надёжность автоматизации" value={data.operational_health.automation_stability} />
          </div>
        </div>
      )}

      {!isLoading && !isError && showDiagnostics && data?.trusted_automation && (
        <div className="glass-card mb-6 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Доверие к автоматизации
          </p>
          <p className="mt-3 text-sm text-on-surface">
            Уровень:{' '}
            <strong>{trustLevelLabel(data.trusted_automation.trust_level)}</strong>
            <span className="text-on-surface-variant">
              {' '}
              · {terminology.trust.aiBaseMode}:{' '}
              {autonomyModeLabel(data.trusted_automation.legacy_ai_action_mode)}
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{data.trusted_automation.rationale_plain}</p>
          {(data.trusted_automation.allowed_auto_actions?.length ?? 0) > 0 && (
            <ul className="mt-3 list-inside list-disc text-xs text-on-surface-variant">
              {data.trusted_automation.allowed_auto_actions.slice(0, mode === 'solo' ? 2 : 5).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <details className="mt-4 rounded-2xl border border-outline/35 bg-surface-container-low/40 px-3 py-2 text-xs text-on-surface-variant dark:bg-white/[0.03]">
            <summary className="cursor-pointer font-medium text-on-surface/90">{terminology.trust.alwaysConfirm}</summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {(data.trusted_automation.always_require_confirmation ?? []).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {!isLoading && !isError && showDiagnostics && (data?.workflow_maintenance?.length ?? 0) > 0 && (
        <section className="mb-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Самообслуживание процессов
          </p>
          <div className="grid gap-3">
            {(data.workflow_maintenance ?? []).map((w) => (
              <GlassCard key={w.id} variant="subtle" className="p-4" hoverLift={false}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{w.kind}</p>
                <p className="mt-1 font-medium text-on-surface">{w.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{w.detail}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {!isLoading && !isError && showDiagnostics && (data?.operational_memory_hints?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-3xl border border-outline/30 bg-surface-container-low/50 px-4 py-3 text-xs leading-relaxed text-on-surface-variant dark:bg-white/[0.03]">
          <p className="font-bold uppercase tracking-wide text-primary">Операционная память</p>
          <ul className="mt-2 space-y-2">
            {(data.operational_memory_hints ?? []).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && !isError && showDiagnostics && data?.calm_ui_budget && mode === 'solo' && (
        <p className="mb-6 text-center text-[10px] leading-relaxed text-on-surface-variant">
          На экране одновременно не больше {data.calm_ui_budget.max_visible_alerts} заметных сигналов — приоритет у одного
          следующего шага.
        </p>
      )}

      {!isLoading && !isError && showDiagnostics && (
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <p className="text-sm text-on-surface-variant">
            Расширенные снимки состояния, аудит и прогнозы — в ops-контуре для администратора.
          </p>
          <Link
            to="/admin/ops"
            className="btn-secondary fc-btn-thumb mt-3 inline-flex text-sm"
          >
            Открыть диагностику
          </Link>
        </GlassCard>
      )}

      {!isLoading && !isError && (data?.work_packs?.length ?? 0) > 0 && (
        <section className="mb-8 fc-section-stack-sm">
          <p className="fc-section-label">Пакеты задач</p>
          {(data?.work_packs ?? []).map((pack) => (
            <WorkPackCard
              key={pack.id}
              pack={pack}
              ackPending={ackPack.isPending}
              onAck={() => {
                recordWorkPack(pack.id, pack.title)
                setNextStep({
                  verb: 'continue',
                  label: 'Продолжить пакет работ',
                  path: pack.primary_action_path || '/operations',
                })
                ackPack.mutate(pack.id)
              }}
              onOpen={openPath}
            />
          ))}
        </section>
      )}

      {data?.ai_summary && showDiagnostics && (
        <p className="mb-8 rounded-2xl border border-outline/35 bg-surface-container-low/70 px-4 py-3 text-sm leading-relaxed text-on-surface-variant">
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
        <CalmErrorState
          title="Лента работы недоступна"
          error={feedError}
          fallbackMessage="Не удалось загрузить ленту. Проверьте доступ к организации и попробуйте снова."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <PremiumEmptyState
          icon="task_alt"
          title="Нет открытых операций"
          description="Все ключевые проверки пройдены — можно заниматься стратегией или следующим периодом."
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <GroupedExecutionFeed
          top={top}
          rest={rest}
          compact={feedCompact}
          onOpen={openPath}
          onInspect={(item) => setPanelItem(item as OperationalItem)}
        />
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
                  <strong className="text-on-surface">Почему сейчас:</strong> {panelItem.ai_why}
                </p>
              )}
              {panelItem.truth_confidence != null && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Уверенность системы: {Math.round(panelItem.truth_confidence * 100)}%
                </p>
              )}
              {executionRiskIfIgnored(panelItem.priority, panelItem.type) && (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                  <strong>Если отложить:</strong> {executionRiskIfIgnored(panelItem.priority, panelItem.type)}
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
    </div>
  )
}
