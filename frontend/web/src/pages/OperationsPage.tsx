import { memo, useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { operationsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { GlassCard } from '../components/premium/GlassCard'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import GroupedExecutionFeed from '../components/operations/GroupedExecutionFeed'
import OperationsProgressStrip from '../components/operations/OperationsProgressStrip'
import { WorkPackCard } from '../components/operations/WorkPackCard'
import OperationalPage from '../components/shell/OperationalPage'
import { orgQueryKey } from '../lib/queryKeys'
import { CalmErrorState } from '../components/errors/CalmErrorState'

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

const TRUST_LEVEL_RU: Record<string, string> = {
  observe_only: 'только наблюдение',
  suggest_only: 'подсказки',
  prepare_only: 'подготовка действий',
  auto_execute_safe: 'безопасные авто-действия',
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
          className="h-full rounded-full bg-gradient-to-r from-primary/70 to-emerald-400/80"
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
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.user?.organization_id ?? '')
  const [panelItem, setPanelItem] = useState<OperationalItem | null>(null)
  const [stateDetailsOpen, setStateDetailsOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

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

  return (
    <OperationalPage
      narrow
      className="pb-28 sm:pb-10"
      eyebrow="Исполнение"
      title="Лента работы"
      description={
        mode === 'solo'
          ? 'Один фокус за раз — что сделать и почему это важно для отчётности.'
          : 'Задачи в порядке срочности: одна кнопка — одно действие.'
      }
      secondaryActions={
        mode !== 'advanced' ? (
          <button
            type="button"
            className="btn-ghost min-h-10 text-xs font-semibold text-primary"
            onClick={() => setDiagnosticsOpen((v) => !v)}
          >
            {diagnosticsOpen ? 'Скрыть диагностику' : 'Диагностика'}
          </button>
        ) : undefined
      }
    >
      {!isLoading && !isError && simplified && (mode === 'solo' || mode === 'operator') && (
        <div className="fixed inset-x-0 top-0 z-20 border-b border-outline/30 bg-[rgb(var(--color-surface)/0.92)] px-3 py-2 shadow-sm backdrop-blur-md sm:hidden">
          <p className="mx-auto max-w-3xl line-clamp-2 text-[11px] font-medium leading-snug text-on-surface">
            {simplified.headline}
          </p>
        </div>
      )}

      <div className={!isLoading && !isError && simplified && (mode === 'solo' || mode === 'operator') ? 'mt-8 sm:mt-0' : ''}>
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
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Операционное здоровье
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
        </GlassCard>
      )}

      {!isLoading && !isError && showDiagnostics && data?.trusted_automation && (
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Доверие к автоматизации
          </p>
          <p className="mt-3 text-sm text-on-surface">
            Уровень:{' '}
            <strong>{TRUST_LEVEL_RU[data.trusted_automation.trust_level] || data.trusted_automation.trust_level}</strong>
            <span className="text-on-surface-variant">
              {' '}
              · базовый режим ИИ: {AUTONOMY_RU[data.trusted_automation.legacy_ai_action_mode] ||
                data.trusted_automation.legacy_ai_action_mode}
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
            <summary className="cursor-pointer font-medium text-on-surface/90">Всегда только с вашим подтверждением</summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {(data.trusted_automation.always_require_confirmation ?? []).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        </GlassCard>
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

      {!isLoading && !isError && showDiagnostics && data?.financial_state && (
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Состояние (детально)
            </p>
            {!showTechnicalStateByDefault && (
              <button
                type="button"
                onClick={() => setStateDetailsOpen((v) => !v)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {stateDetailsOpen ? 'Свернуть' : 'Показать детали'}
              </button>
            )}
          </div>
          {(showTechnicalStateByDefault || stateDetailsOpen) && (
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
          )}
          {(showTechnicalStateByDefault || stateDetailsOpen) && (
          <p className="mt-4 text-xs text-on-surface-variant">
            Автономность ИИ:{' '}
            <strong className="text-on-surface">
              {AUTONOMY_RU[data.default_autonomy_mode] || data.default_autonomy_mode}
            </strong>{' '}
            — подготовка без массового автопроведения.
          </p>
          )}
        </GlassCard>
      )}

      {!isLoading && !isError && showDiagnostics && data?.truth_governance && (
        <GlassCard variant="subtle" className="mb-6 p-5" hoverLift={false}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Согласованность данных
          </p>
          <p className="mt-3 text-sm text-on-surface">
            Уверенность снимка:{' '}
            <strong>{(data.truth_governance.state_confidence * 100).toFixed(1)}%</strong>
            {data.truth_governance.frozen_dimensions?.length ? (
              <>
                {' '}
                · Заморожено: <strong>{data.truth_governance.frozen_dimensions.join(', ')}</strong>
              </>
            ) : null}
          </p>
          {(data.truth_governance.conflicts?.length ?? 0) > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-on-surface-variant">
              {data.truth_governance.conflicts.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-on-surface">{c.title}</span> — {c.detail}
                </li>
              ))}
            </ul>
          )}
          {(data.truth_governance.governance_violations?.length ?? 0) > 0 && (
            <ul className="mt-2 text-xs text-amber-100/95">
              {data.truth_governance.governance_violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-on-surface-variant">
            Правил в каталоге: {data.truth_governance.rules_catalog?.length ?? 0} · версия{' '}
            {data.truth_governance.governance_version}
          </p>
        </GlassCard>
      )}

      {!isLoading && !isError && showDiagnostics && (data?.recent_state_audit?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-3xl border border-outline/35 bg-surface-container-low/50 px-4 py-3 text-xs text-on-surface-variant dark:bg-white/[0.03]">
          <p className="font-bold uppercase tracking-wide text-primary">Аудит состояния</p>
          <ul className="mt-2 space-y-2">
            {(data.recent_state_audit ?? []).slice(0, 3).map((a) => (
              <li key={a.id} className="leading-snug">
                <span className="text-on-surface">{a.trigger_event}</span> · {a.new_state_summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && !isError && showDiagnostics && (data?.state_predictions?.length ?? 0) > 0 && (
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
        <section className="mb-8 fc-section-stack-sm">
          <p className="fc-section-label">Пакеты подготовки</p>
          {(data?.work_packs ?? []).map((pack) => (
            <WorkPackCard
              key={pack.id}
              pack={pack}
              ackPending={ackPack.isPending}
              onAck={() => ackPack.mutate(pack.id)}
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
    </OperationalPage>
  )
}
