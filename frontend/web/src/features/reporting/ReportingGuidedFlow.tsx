import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'
import { useOperational } from '../../context/OperationalContext'
import { useAuthStore } from '../../store/authStore'
import { orgQueryKey } from '../../lib/queryKeys'
import {
  loadReportingFlowStep,
  loadReportingFlowValidated,
  saveReportingFlowStep,
  saveReportingFlowValidated,
} from '../../lib/reportingFlowSession'
import { snapshotLevelRu } from '../../lib/financialSnapshotLabels'
import {
  type CalmOverviewLike,
  type FlowStepId,
  READINESS_THRESHOLD,
  buildFlowSteps,
  buildReportingPeriodNarrative,
  canLeaveFixStep,
  deriveIssuesForStep,
  flowStepPanelTitle,
  operationalAiHint,
  readinessBlockedReason,
  type ReportingFlowStep,
} from './reportingFlowModel'
import ReportingPeriodNarrative from './ReportingPeriodNarrative'
import MoneyAmount from '../../components/ui/MoneyAmount'

function StepRail({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: ReportingFlowStep[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="relative px-1">
      <div className="flex items-center justify-between gap-0.5 sm:gap-1">
        {steps.map((s, i) => {
          const done = s.status === 'completed'
          const active = s.status === 'active'
          const locked = s.status === 'locked'
          return (
            <button
              key={s.id}
              type="button"
              title={locked && i > activeIndex ? 'Сначала пройдите текущий шаг' : i < activeIndex ? 'Вернуться к шагу' : ''}
              disabled={locked && i > activeIndex}
              onClick={() => {
                if (i < activeIndex) onSelect(i)
              }}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 tap-highlight-none ${
                locked && i > activeIndex
                  ? 'cursor-not-allowed opacity-40'
                  : i < activeIndex
                    ? 'cursor-pointer'
                    : 'cursor-default'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition sm:h-10 sm:w-10 ${
                  active
                    ? 'bg-primary text-white shadow-glow ring-2 ring-primary/30'
                    : done
                      ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-100'
                      : 'border border-outline-variant/40 bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`max-w-[4.5rem] truncate text-center text-[9px] font-bold uppercase leading-tight ${
                  active ? 'text-primary' : done ? 'text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                <span className="sm:hidden">{s.shortLabel}</span>
                <span className="hidden sm:inline">{s.title}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div
        className="pointer-events-none absolute left-[9%] right-[9%] top-[18px] -z-0 hidden h-0.5 bg-outline-variant/35 sm:block"
        aria-hidden
      />
    </div>
  )
}

function stateChipClass(s: string) {
  switch (s) {
    case 'overdue':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
    case 'needs_attention':
      return 'border-primary/35 bg-primary/[0.08] text-primary'
    case 'submitted':
      return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
    case 'ready':
      return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100'
    default:
      return 'border-outline-variant/40 bg-surface-container-high text-on-surface-variant'
  }
}

const STATE_LABEL: Record<string, string> = {
  draft: 'Черновик',
  preparing: 'В работе',
  ready: 'Готово к проверке',
  needs_attention: 'Нужен контроль',
  submitted: 'Готово',
  overdue: 'Просрочено',
}

function severityCardClass(sev: string) {
  if (sev === 'risk') return 'border-rose-300/30 bg-rose-500/[0.05]'
  if (sev === 'attention') return 'border-amber-400/25 bg-amber-500/[0.06]'
  return 'border-emerald-400/20 bg-emerald-500/[0.05]'
}

type Props = { basePath?: string }

export default function ReportingGuidedFlow({ basePath = '/reports' }: Props) {
  const base = basePath.replace(/\/$/, '') || '/reports'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { recordReportingBlocker, setNextStep } = useOperational()
  const orgId = useAuthStore((s) => s.user?.organization_id ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [validationPassed, setValidationPassed] = useState(false)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    if (!orgId) {
      setStepIndex(0)
      setValidationPassed(false)
      return
    }
    setStepIndex(loadReportingFlowStep(orgId))
    setValidationPassed(loadReportingFlowValidated(orgId))
  }, [orgId])

  const calmKey = orgQueryKey('reporting-calm-overview')

  const q = useQuery({
    queryKey: calmKey,
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  const data = q.data as CalmOverviewLike | undefined
  const periodNarrative = useMemo(() => buildReportingPeriodNarrative(data), [data])

  const validateMut = useMutation({
    mutationFn: () => reportingCalmApi.validate().then((r) => r.data),
    onSuccess: (payload) => {
      qc.setQueryData(calmKey, payload)
      setValidationPassed(true)
      if (orgId) saveReportingFlowValidated(orgId, true)
      const overview = payload as CalmOverviewLike
      const blockers = overview?.readiness?.blockers ?? []
      const label =
        blockers.length > 0
          ? `Отчётность: ${blockers[0].label}`
          : `Готовность ${overview?.readiness?.score ?? '—'}%`
      recordReportingBlocker(label, base)
      setNextStep({
        verb: 'send',
        label: 'Продолжить черновик отчёта',
        path: base,
      })
    },
  })

  const prepMut = useMutation({
    mutationFn: () => reportingCalmApi.startPreparation({}),
  })

  const steps = useMemo(() => buildFlowSteps(stepIndex, data), [stepIndex, data])

  useEffect(() => {
    if (orgId) saveReportingFlowStep(orgId, stepIndex)
  }, [orgId, stepIndex])

  useEffect(() => {
    if (orgId) saveReportingFlowValidated(orgId, validationPassed)
  }, [orgId, validationPassed])

  const score = data?.readiness?.score ?? null
  const conf = data?.readiness?.confidence ?? 'medium'

  const goToStep = useCallback((i: number) => {
    setStepIndex(Math.min(4, Math.max(0, i)))
  }, [])

  const tryNext = useCallback(() => {
    if (stepIndex === 1 && !canLeaveFixStep(data)) return
    if (stepIndex === 2 && !validationPassed) return
    goToStep(stepIndex + 1)
  }, [data, goToStep, stepIndex, validationPassed])

  const tryPrev = useCallback(() => {
    goToStep(stepIndex - 1)
  }, [goToStep, stepIndex])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (dx < -48) tryNext()
    else if (dx > 48) tryPrev()
  }

  const activeId = steps[stepIndex]?.id as FlowStepId | undefined

  const primarySecondary = useMemo((): { primary: string; secondary: string; primaryDisabled: boolean } => {
    if (!activeId) return { primary: '', secondary: '', primaryDisabled: true }
    switch (activeId) {
      case 'review':
        return {
          primary: 'Дальше: замечания и данные',
          secondary: 'Обновить сводку',
          primaryDisabled: false,
        }
      case 'fix':
        return {
          primary: canLeaveFixStep(data) ? 'Готово к проверке AI' : `Исправьте данные (≥${READINESS_THRESHOLD}%)`,
          secondary: 'Открыть учёт',
          primaryDisabled: !canLeaveFixStep(data),
        }
      case 'validate':
        return {
          primary: validationPassed ? 'Дальше: черновик отчёта' : 'Запустить проверку AI',
          secondary: 'Обновить проверку ещё раз',
          primaryDisabled: validationPassed ? false : validateMut.isPending,
        }
      case 'generate':
        return { primary: 'Открыть ИМНС (черновик)', secondary: 'Все органы на странице', primaryDisabled: false }
      case 'submit':
        return { primary: 'К списку заявок', secondary: 'Назад к обзору', primaryDisabled: false }
      default:
        return { primary: '', secondary: '', primaryDisabled: true }
    }
  }, [activeId, data, validationPassed, validateMut.isPending])

  function onPrimaryAction() {
    if (!activeId) return
    if (activeId === 'validate' && !validationPassed) {
      validateMut.mutate()
      return
    }
    if (activeId === 'validate' && validationPassed) {
      tryNext()
      return
    }
    if (activeId === 'submit') {
      document.getElementById('fc-report-submissions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (activeId === 'generate') {
      navigate(`${base}/imns`)
      return
    }
    tryNext()
  }

  function onSecondaryAction() {
    if (!activeId) return
    if (activeId === 'review') {
      void q.refetch()
      return
    }
    if (activeId === 'fix') {
      navigate('/accounting/journal')
      return
    }
    if (activeId === 'validate') {
      validateMut.mutate()
      return
    }
    if (activeId === 'generate') {
      document.getElementById('fc-report-authorities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (activeId === 'submit') {
      goToStep(0)
    }
  }

  const activeMeta = steps[stepIndex]

  return (
    <div className="mt-6 space-y-5 pb-28 lg:pb-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <ReportingPeriodNarrative data={data} onGoToStep={goToStep} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Гид подготовки</p>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            {periodNarrative.periodLabel} — по шагам к сдаче
          </h2>
        </div>
        <p className="max-w-md text-xs text-on-surface-variant sm:text-right">
          Свайп влево / «Дальше» — следующий шаг. Порог готовности {READINESS_THRESHOLD}% перед контролем AI.
        </p>
      </div>

      <div className="fc-surface-elevated p-4 sm:p-5">
        <StepRail steps={steps} activeIndex={stepIndex} onSelect={goToStep} />
      </div>

      {data?.financial_state && (
        <div className="rounded-3xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-xs leading-relaxed text-on-surface sm:text-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Канонический снимок состояния</p>
          <p className="mt-2">
            Риск: <strong>{snapshotLevelRu(data.financial_state.risk_level)}</strong>
            {' · '}
            Отчётность: <strong>{snapshotLevelRu(data.financial_state.reporting_status?.status)}</strong>
            {' · '}
            Комплаенс: <strong>{snapshotLevelRu(data.financial_state.compliance_state?.level)}</strong>
            {' · '}
            Первичка: <strong>{data.financial_state.document_completeness?.score}%</strong>
            {' · '}
            Касса: <strong>{snapshotLevelRu(data.financial_state.cashflow_state?.level)}</strong>
          </p>
          {(data.state_predictions?.length ?? 0) > 0 && (
            <ul className="mt-2 list-inside list-disc text-on-surface-variant">
              {(data.state_predictions ?? []).slice(0, 2).map((p) => (
                <li key={p.id}>
                  ~{p.horizon_days} дн.: {p.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Только активный шаг — полный контент; остальное в rail */}
      <div className="fc-surface-elevated p-5 sm:p-7">
        <div className="flex flex-col gap-2 border-b border-outline-variant/15 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {activeId ? flowStepPanelTitle(activeId, periodNarrative.periodLabel) : ''}
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {activeMeta?.subtitle ?? 'Что делать дальше'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary min-h-10 px-4 text-xs font-bold"
              disabled={stepIndex === 0}
              onClick={tryPrev}
            >
              Назад
            </button>
            <button
              type="button"
              className="btn-primary min-h-10 px-4 text-xs font-bold"
              disabled={
                stepIndex === 4 ||
                (stepIndex === 1 && !canLeaveFixStep(data)) ||
                (stepIndex === 2 && !validationPassed)
              }
              onClick={tryNext}
            >
              Дальше
            </button>
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm leading-relaxed text-on-surface">
          <span className="font-semibold text-primary">Подсказка: </span>
          {operationalAiHint(data)}
        </p>

        {/* Active step body */}
        <div className="mt-6 space-y-6">
          {activeId === 'review' && (
            <>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div
                  className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 shadow-inner"
                  style={{
                    background:
                      score !== null
                        ? `conic-gradient(rgb(16 185 129 / 0.85) ${score * 3.6}deg, rgb(var(--color-surface-variant) / 0.35) 0deg)`
                        : undefined,
                  }}
                >
                  <div className="flex h-[5rem] w-[5rem] flex-col items-center justify-center rounded-full bg-[rgb(var(--color-surface)/0.94)] dark:bg-[rgb(var(--color-surface)/0.88)]">
                    {score !== null ? (
                      <>
                        <span className="font-headline text-xl font-extrabold">{score}</span>
                        <span className="text-[9px] font-bold uppercase text-on-surface-variant">готовность</span>
                      </>
                    ) : (
                      <span className="text-xs text-on-surface-variant">…</span>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    {data?.ai_summary ||
                      'Сводка учитывает журнал, сканы и сроки — вы всегда видите актуальный снимок.'}
                  </p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Уверенность:{' '}
                    <span className="font-semibold text-on-surface">
                      {conf === 'high' ? 'высокая' : conf === 'medium' ? 'средняя' : 'нужны правки'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
                  <p className="text-xs font-bold text-on-surface">Обязательства (фрагмент)</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {data?.obligations_preview?.slice(0, 4).map((o: any) => (
                      <li key={o.id} className="flex justify-between gap-2 text-on-surface">
                        <span className="inline-flex flex-wrap items-baseline gap-1">
                          {String(o.obligation_type || '').toUpperCase()} · <MoneyAmount value={o.amount} className="inline-flex" />
                        </span>
                        <span className="text-xs text-on-surface-variant">{o.due_date}</span>
                      </li>
                    ))}
                    {!data?.obligations_preview?.length && !q.isLoading && (
                      <li className="text-on-surface-variant">Нет записей в превью.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
                  <p className="text-xs font-bold text-on-surface">Шкала времени (фрагмент)</p>
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                    {data?.timeline?.slice(0, 5).map((item: any) => (
                      <div key={item.id} className="flex gap-2 text-xs">
                        <span className="w-14 shrink-0 text-on-surface-variant">{item.date}</span>
                        <span className="min-w-0 flex-1 font-medium text-on-surface">{item.title}</span>
                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${stateChipClass(item.state)}`}>
                          {STATE_LABEL[item.state] || item.state}
                        </span>
                      </div>
                    ))}
                    {!data?.timeline?.length && !q.isLoading && (
                      <p className="text-on-surface-variant">Пока пусто.</p>
                    )}
                  </div>
                </div>
              </div>
              {deriveIssuesForStep('review', data).length > 0 && (
                <ul className="text-xs text-on-surface-variant">
                  {deriveIssuesForStep('review', data).map((x, i) => (
                    <li key={i}>· {x}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {activeId === 'fix' && (
            <>
              {readinessBlockedReason(data) && (
                <p className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-on-surface">
                  {readinessBlockedReason(data)}
                </p>
              )}
              {data?.readiness?.blockers && data.readiness.blockers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Блокеры готовности</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {data.readiness.blockers.map((b: { code: string; label: string }) => (
                      <li key={b.code}>· {b.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Согласованность</p>
                <div className="mt-2 space-y-2">
                  {!data?.consistency_issues?.length && !q.isLoading && (
                    <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90">Замечаний нет.</p>
                  )}
                  {data?.consistency_issues?.map(
                    (issue: {
                      id: string
                      severity: string
                      title: string
                      detail: string
                      fix_hint: string
                      action_path?: string
                    }) => (
                      <div key={issue.id} className={`rounded-2xl border px-3 py-2.5 ${severityCardClass(issue.severity)}`}>
                        <p className="text-sm font-semibold">{issue.title}</p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">{issue.detail}</p>
                        <p className="mt-1 text-xs">{issue.fix_hint}</p>
                        {issue.action_path && (
                          <Link to={issue.action_path} className="mt-2 inline-block text-xs font-bold text-primary hover:underline">
                            Перейти
                          </Link>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </>
          )}

          {activeId === 'validate' && (
            <>
              <p className="text-sm text-on-surface-variant">
                Пересчёт готовности и событие проверки — используйте основную кнопку внизу или «Обновить проверку ещё раз».
              </p>
              {validationPassed && (
                <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.07] px-4 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Проверка выполнена. Нажмите «Дальше» или перейдите к черновику через действие ниже.
                </p>
              )}
              <button
                type="button"
                className="btn-secondary min-h-10 px-4 text-xs font-bold"
                disabled={prepMut.isPending}
                onClick={() => prepMut.mutate()}
              >
                {prepMut.isPending ? 'Запись…' : 'Зафиксировать старт подготовки (событие)'}
              </button>
              {deriveIssuesForStep('validate', data).map((x, i) => (
                <p key={i} className="text-xs text-on-surface-variant">
                  · {x}
                </p>
              ))}
            </>
          )}

          {activeId === 'generate' && (
            <div className="space-y-3 text-sm leading-relaxed text-on-surface-variant">
              <p>Сформируйте черновик в разделе органа: данные подтянутся из учёта и кадров, где это возможно.</p>
              <p className="text-xs text-on-surface-variant sm:hidden">На телефоне используйте главную кнопку «Открыть ИМНС» ниже — быстрый выбор всех органов ниже на странице.</p>
              <div className="hidden sm:flex sm:flex-wrap sm:gap-2">
                <Link to={`${base}/imns`} className="btn-primary inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold">
                  ИМНС
                </Link>
                <Link to={`${base}/fsszn`} className="btn-secondary inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold">
                  ФСЗН
                </Link>
                <Link to={`${base}/belgosstrakh`} className="btn-secondary inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold">
                  Белгосстрах
                </Link>
                <Link to={`${base}/belstat`} className="btn-secondary inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold">
                  Белстат
                </Link>
              </div>
            </div>
          )}

          {activeId === 'submit' && (
            <div className="space-y-3 text-sm text-on-surface-variant">
              <p>Подтвердите пакет и отправьте в контур — список заявок ниже на этой странице.</p>
              <p className="text-xs">После отправки статус придёт в уведомления и в карточку заявки.</p>
            </div>
          )}
        </div>

        {/* Decision row — sticky on mobile */}
        <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-40 -mx-1 mt-8 flex flex-col gap-3 rounded-t-2xl border border-outline/35 bg-surface/95 p-3 shadow-float backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:static lg:z-auto lg:mx-0 lg:rounded-none lg:border-0 lg:border-t lg:border-outline-variant/15 lg:bg-transparent lg:p-0 lg:pt-6 lg:shadow-none lg:backdrop-blur-none">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Действие</p>
            <p className="mt-1 text-sm font-bold text-on-surface">{primarySecondary.primary}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="btn-primary min-h-12 w-full px-6 text-sm font-bold sm:min-w-[200px] sm:w-auto"
              disabled={primarySecondary.primaryDisabled}
              onClick={onPrimaryAction}
            >
              {activeId === 'validate' && !validationPassed ? 'Запустить проверку AI' : primarySecondary.primary}
            </button>
            <button
              type="button"
              className="btn-secondary min-h-12 w-full px-5 text-sm font-bold sm:w-auto"
              onClick={onSecondaryAction}
            >
              {primarySecondary.secondary}
            </button>
          </div>
        </div>

        {/* Mobile swipe hint */}
        <p className="mt-6 text-center text-[11px] text-on-surface-variant lg:hidden">Свайп ← следующий шаг · свайп → назад</p>
      </div>
    </div>
  )
}
