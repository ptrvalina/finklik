import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { formatMoney } from '../../lib/formatMoney'
import { snapshotReportingStatusRu } from '../../lib/financialSnapshotLabels'

type StateBlock = {
  cashflow_state: { level: string; summary: string; health_signal: string; monthly_net: number | string }
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

const RISK_RU: Record<string, { label: string; tone: 'ok' | 'warn' | 'risk' }> = {
  low: { label: 'Низкий', tone: 'ok' },
  medium: { label: 'Средний', tone: 'warn' },
  high: { label: 'Высокий', tone: 'warn' },
  critical: { label: 'Критический', tone: 'risk' },
}

function toneClasses(tone: 'ok' | 'warn' | 'risk') {
  if (tone === 'ok') return 'fc-execution-card--tone-ok'
  if (tone === 'risk') return 'fc-execution-card--tone-risk'
  return 'fc-execution-card--tone-warn'
}

export default function FinancialStateHero({
  compact,
  className = '',
  cashOnHand,
  nextTaxDeadline,
  dashboardLite,
}: {
  compact?: boolean
  className?: string
  cashOnHand?: number | null
  nextTaxDeadline?: string | null
  dashboardLite?: boolean
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  })

  const state = data?.state as StateBlock | undefined

  const riskMeta = useMemo(() => {
    if (!state) return null
    return RISK_RU[state.risk_level] ?? RISK_RU.medium
  }, [state])

  if (isLoading) {
    return (
      <div
        className={`animate-pulse rounded-xl border border-outline/25 bg-surface-container-low/50 ${compact ? 'h-24' : 'h-28'} ${className}`}
      />
    )
  }

  if (isError || !state || !riskMeta) {
    return (
      <section className={`rounded-xl border border-outline/30 bg-surface p-4 ${className}`}>
        <p className="text-sm text-on-surface-variant">Не удалось загрузить остаток и движение денег.</p>
        <Link to="/bank" className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
          Открыть банк
        </Link>
      </section>
    )
  }

  const monthlyNet = Number(state.cashflow_state.monthly_net ?? 0)
  const hasCash = cashOnHand != null && Number.isFinite(cashOnHand)
  const reportingLabel = snapshotReportingStatusRu(state.reporting_status.status)

  return (
    <section
      className={`fc-execution-card p-4 ${toneClasses(riskMeta.tone)} ${className}`}
      aria-label="Деньги"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Деньги</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <p className="text-[10px] text-on-surface-variant">На счетах</p>
          <p className="font-headline text-2xl font-extrabold tabular-nums text-on-surface sm:text-3xl">
            {hasCash ? formatMoney(cashOnHand) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant">За месяц</p>
          <p className={`text-lg font-bold tabular-nums ${monthlyNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatMoney(monthlyNet, { signed: true })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        {nextTaxDeadline ? (
          <span>
            Налог к уплате: <span className="font-semibold text-on-surface">{nextTaxDeadline}</span>
          </span>
        ) : null}
        <span>
          Риск:{' '}
          <span className={`font-semibold ${riskMeta.tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : riskMeta.tone === 'risk' ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>
            {riskMeta.label}
          </span>
        </span>
        {!dashboardLite ? (
          <span>
            Отчётность: <span className="font-semibold text-on-surface">{reportingLabel}</span>
          </span>
        ) : null}
      </div>

      {!compact && state.compliance_state.overdue_obligations > 0 && (
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          Просрочено обязательств: {state.compliance_state.overdue_obligations}
        </p>
      )}

      {!dashboardLite && (
        <Link to="/bank" className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">
          Банк и выписки →
        </Link>
      )}
    </section>
  )
}
