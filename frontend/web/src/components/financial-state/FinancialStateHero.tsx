import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { terminology } from '../../i18n/terminology.ru'
import { snapshotReportingStatusRu } from '../../lib/financialSnapshotLabels'

type StateBlock = {
  cashflow_state: { level: string; summary: string; health_signal: string }
  operational_readiness: { score: number; label: string; confidence: string }
  compliance_state: {
    level: string
    summary: string
    pending_approvals: number
    open_inbox_items: number
    overdue_obligations: number
  }
  document_completeness: { score: number; summary: string; pending_ocr: number }
  reporting_status: { status: string; readiness_score: number; summary: string; blocker_codes: string[] }
  risk_level: string
}

const RISK_RU: Record<string, { headline: string; tone: 'ok' | 'warn' | 'risk' }> = {
  low: { headline: 'Ситуация под контролем', tone: 'ok' },
  medium: { headline: 'Есть темы для внимания', tone: 'warn' },
  high: { headline: 'Нужны действия до дедлайнов', tone: 'warn' },
  critical: { headline: 'Блокеры мешают отчётности', tone: 'risk' },
}

function toneClasses(tone: 'ok' | 'warn' | 'risk') {
  if (tone === 'ok') return 'fc-execution-card--tone-ok'
  if (tone === 'risk') return 'fc-execution-card--tone-risk'
  return 'fc-execution-card--tone-warn'
}

export default function FinancialStateHero({
  compact,
  className = '',
}: {
  compact?: boolean
  className?: string
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  })

  const state = data?.state as StateBlock | undefined

  const meta = useMemo(() => {
    if (!state) return null
    const risk = RISK_RU[state.risk_level] ?? RISK_RU.medium
    const primaryCta =
      state.reporting_status.status === 'blocked' || state.reporting_status.status === 'at_risk'
        ? { to: '/reports', label: 'Открыть отчётность' }
        : state.document_completeness.pending_ocr > 0
          ? { to: '/scan', label: 'Разобрать сканы' }
          : state.compliance_state.pending_approvals > 0
            ? { to: '/approvals', label: 'Согласования' }
            : { to: '/operations', label: terminology.execution.executionFeed }
    return { risk, primaryCta }
  }, [state])

  if (isLoading) {
    return (
      <div
        className={`animate-pulse rounded-[1.75rem] border border-outline/25 bg-surface-container-low/50 ${compact ? 'h-28' : 'h-36'} ${className}`}
      />
    )
  }

  if (isError || !state || !meta) return null

  const dims = [
    { label: 'Готовность', value: `${state.operational_readiness.score}%`, hint: state.operational_readiness.label },
    { label: 'Первичка', value: `${state.document_completeness.score}%`, hint: state.document_completeness.summary },
    {
      label: terminology.nav.reports,
      value: snapshotReportingStatusRu(state.reporting_status.status),
      hint: state.reporting_status.summary,
    },
  ]

  return (
    <section
      className={`fc-execution-card p-5 sm:p-6 ${toneClasses(meta.risk.tone)} ${className}`}
      aria-label={terminology.execution.financialStateShort}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
            {terminology.execution.financialStateShort}
          </p>
          <h2 className="mt-2 font-headline text-xl font-bold leading-snug text-on-surface sm:text-2xl">{meta.risk.headline}</h2>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{state.cashflow_state.summary}</p>
          {!compact && (
            <p className="mt-2 text-xs text-on-surface-variant">
              {terminology.execution.compliance}: {state.compliance_state.summary}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link to={meta.primaryCta.to} className="btn-primary fc-btn-thumb text-sm">
            {meta.primaryCta.label}
          </Link>
          <Link to="/control/state" className="btn-ghost text-xs font-semibold text-primary">
            Подробнее о состоянии
          </Link>
        </div>
      </div>
      {!compact && (
        <div className="mt-5 grid gap-3 border-t border-outline/20 pt-5 sm:grid-cols-3">
          {dims.map((d) => (
            <div key={d.label} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{d.label}</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{d.value}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">{d.hint}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
