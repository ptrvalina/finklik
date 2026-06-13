import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { taxApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import MoneyAmount from '../components/ui/MoneyAmount'
import AccountingNavTabs from '../components/accounting/AccountingNavTabs'
import {
  FilterBar,
  GlassCard,
  HeroGradient,
  PageHeader,
  StatCard,
  StatusChip,
  StitchIcon,
} from '../components/stitch'

function quarterDates() {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const sm = q * 3
  return { start: new Date(now.getFullYear(), sm, 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), sm + 3, 0).toISOString().slice(0, 10) }
}

export default function TaxesPage() {
  const defaults = quarterDates()
  const [periodStart, setPeriodStart] = useState(defaults.start)
  const [periodEnd, setPeriodEnd] = useState(defaults.end)
  const [withVat, setWithVat] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey(['tax-calc', periodStart, periodEnd, withVat]),
    queryFn: () => taxApi.calculate({ period_start: periodStart, period_end: periodEnd, with_vat: withVat }).then((r) => r.data),
  })

  const { data: calendarData, isError: calendarError } = useQuery({
    queryKey: orgQueryKey(['tax-calendar', year]),
    queryFn: () => taxApi.calendar(year).then((r) => r.data),
  })
  const {
    data: rulesValidation,
    refetch: refetchRulesValidation,
    isFetching: isRulesValidationFetching,
  } = useQuery({
    queryKey: orgQueryKey('tax-rules-validation'),
    queryFn: () => taxApi.validateRules().then((r) => r.data),
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
  const fallbackReason =
    rulesValidation?.using_fallback && Array.isArray(rulesValidation.errors) && rulesValidation.errors.length > 0
      ? String(rulesValidation.errors[0])
      : null

  const daysToDeadline = data?.deadline
    ? Math.ceil((new Date(data.deadline).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <AccountingNavTabs />

      <PageHeader
        title="Налоги"
        subtitle={
          <>
            Расчёт УСН и ФСЗН по данным журнала. Сроки уплаты — в{' '}
            <Link to="/calendar" className="font-semibold text-primary hover:underline">
              календаре
            </Link>
            .
          </>
        }
        actions={
          <>
            <button type="button" className="btn-secondary inline-flex min-h-touch-min items-center gap-2 rounded-full px-4 py-2 text-sm" onClick={() => refetch()}>
              <StitchIcon name="calculate" className="text-lg" />
              Пересчитать
            </button>
            <Link to="/reports" className="btn-primary inline-flex min-h-touch-min items-center gap-2 rounded-full px-6 py-2 text-sm">
              <StitchIcon name="assignment_turned_in" className="text-lg" />
              К отчётности
            </Link>
          </>
        }
      />

      <HeroGradient className="relative mb-section-sm overflow-hidden shadow-xl">
        <div className="absolute right-[-10%] top-[-20%] h-64 w-64 rounded-full bg-tertiary-fixed-dim/10 blur-[80px]" aria-hidden />
        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <h2 className="font-display-lg text-display-lg text-white">Расчёт за период</h2>
            <p className="mt-2 text-body-base text-primary-fixed/90">
              {data?.total_to_pay != null ? (
                <>
                  К уплате за выбранный период —{' '}
                  <MoneyAmount value={data.total_to_pay} className="font-semibold text-white" />
                  {data.deadline ? `. Крайний срок — ${data.deadline}.` : '.'}
                </>
              ) : (
                'Выберите период и нажмите «Пересчитать», чтобы получить оценку налоговой нагрузки.'
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/reports" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-primary shadow-lg transition hover:shadow-primary-container/20 active:scale-95">
                <StitchIcon name="payments" className="text-sm" />
                К отчётности
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 active:scale-95"
                onClick={() => refetch()}
              >
                Пересчитать
              </button>
            </div>
          </div>
          <GlassCard hover={false} className="w-full border-white/10 bg-white/5 p-6 backdrop-blur-xl md:w-80">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-label text-label-caps uppercase tracking-widest text-primary-fixed">Срок уплаты</span>
              {daysToDeadline != null && daysToDeadline <= 14 ? (
                <StatusChip variant={daysToDeadline <= 3 ? 'error' : 'pending'}>
                  {daysToDeadline <= 0 ? 'Сегодня' : `${daysToDeadline} дн.`}
                </StatusChip>
              ) : null}
            </div>
            <p className="font-headline text-headline-md text-white">{data?.deadline ?? '—'}</p>
            <p className="mt-2 text-xs text-white/70">
              {daysToDeadline != null && daysToDeadline <= 14
                ? 'Подготовьте платёж и подачу в отчётности, пока данные журнала актуальны.'
                : 'Следите за календарём налоговых событий.'}
            </p>
          </GlassCard>
        </div>
      </HeroGradient>

      <section className="mb-section-sm grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="payments"
          label="К уплате"
          value={data ? <MoneyAmount value={data.total_to_pay} className="text-inherit" /> : '—'}
          hint="за период"
        />
        <StatCard
          icon="receipt_long"
          label="УСН"
          value={data ? <MoneyAmount value={data.usn_to_pay} className="text-inherit" /> : '—'}
        />
        <StatCard
          icon="event"
          iconTint={daysToDeadline != null && daysToDeadline <= 3 ? 'error' : 'primary'}
          label="До срока"
          value={daysToDeadline != null ? (daysToDeadline <= 0 ? 'Сегодня' : `${daysToDeadline} дн.`) : '—'}
          hint={data?.deadline ?? 'Дедлайн'}
        />
        <StatCard icon="calendar_today" label="События" value={calendarData?.events?.length ?? 0} hint={`Календарь ${year}`} />
      </section>

      {daysToDeadline !== null && daysToDeadline <= 14 && (
        <GlassCard hover={false} className={`mb-4 p-4 ${daysToDeadline <= 3 ? 'border-amber-400/40' : ''}`}>
          <p className="text-sm font-semibold text-on-surface">
            {daysToDeadline <= 0 ? 'Срок уплаты наступил' : `До срока ${daysToDeadline} дн.`}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Подготовьте платёж и подачу в отчётности, пока данные журнала актуальны.
          </p>
          <Link to="/reports" className="btn-primary mt-3 inline-flex text-sm">
            Отчётность
          </Link>
        </GlassCard>
      )}

      <FilterBar className="mb-6">
        <div className="min-w-[140px] flex-1">
          <label className="label">Период с</label>
          <input type="date" className="input mt-1" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="label">Период по</label>
          <input type="date" className="input mt-1" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-on-surface-variant">
          <input type="checkbox" checked={withVat} onChange={(e) => setWithVat(e.target.checked)} className="rounded" />
          Плательщик НДС
        </label>
      </FilterBar>

      {(isError || calendarError) && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          <StitchIcon name="error" className="text-lg" />
          Не удалось загрузить данные
        </div>
      )}
      {rulesValidation && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            rulesValidation.ok
              ? 'border border-secondary/20 bg-secondary/10 text-secondary'
              : 'border border-error/20 bg-error/10 text-error'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">
              Налоговые правила: {rulesValidation.ok ? 'валидны' : 'ошибка конфигурации'}
            </span>
            <span className="text-xs opacity-80">Источник: {rulesValidation.source}</span>
            <button
              type="button"
              className="rounded border border-current/30 px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => refetchRulesValidation()}
              disabled={isRulesValidationFetching}
            >
              {isRulesValidationFetching ? 'Обновляем...' : 'Обновить статус правил'}
            </button>
            {rulesValidation.using_fallback && (
              <span className="rounded bg-error/20 px-2 py-0.5 text-xs font-semibold text-error">резервные правила</span>
            )}
            {Array.isArray(rulesValidation.years) && (
              <span className="text-xs opacity-80">Годы: {rulesValidation.years.join(', ')}</span>
            )}
          </div>
          {Array.isArray(rulesValidation.warnings) && rulesValidation.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs opacity-90">
              {rulesValidation.warnings.map((w: string, i: number) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
          {Array.isArray(rulesValidation.errors) && rulesValidation.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {rulesValidation.errors.map((e: string, i: number) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
          {rulesValidation.using_fallback && (
            <div className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
              <span className="font-semibold">Причина резервного режима:</span>{' '}
              {fallbackReason || 'Конфиг налоговых правил недоступен, используются встроенные значения.'}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard hover={false} className="p-5 sm:p-6">
          <h2 className="mb-6 flex items-center gap-2 font-headline text-headline-sm text-on-surface">
            <StitchIcon name="receipt" className="text-primary" />
            Итоги периода
          </h2>
          {isLoading || !data ? (
            <div className="text-sm text-on-surface-variant">Считаем...</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-container-high/40 px-3 py-2 text-[11px] text-on-surface-variant">
                Режим: <span className="font-semibold text-on-surface">{data.tax_regime}</span>
              </div>
              {data.regulatory_version && (
                <div className="rounded-lg bg-surface-container-high/40 px-3 py-2 text-[11px] text-on-surface-variant">
                  Нормативка: <span className="font-semibold text-on-surface">{data.regulatory_version}</span>
                  {data.regulatory_year ? ` (${data.regulatory_year})` : ''}
                </div>
              )}
              {[
                { label: 'Доходы', amount: data.income, color: 'text-secondary' },
                { label: 'Расходы', amount: data.expense, color: 'text-error' },
                { label: 'УСН к уплате', amount: data.usn_to_pay, bold: true },
                { label: 'НДС к уплате', amount: data.vat_to_pay },
                { label: 'ФСЗН (наниматель)', amount: data.fsszn_employer_amount },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-outline-variant/10 pb-3 last:border-0">
                  <span className="text-sm text-on-surface-variant">{row.label}</span>
                  <MoneyAmount
                    value={row.amount}
                    className={`text-sm ${row.bold ? 'font-bold' : ''} ${row.color || 'text-on-surface'}`}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between border-t-2 border-outline-variant/20 pt-3">
                <span className="text-sm font-bold text-on-surface">Итого к уплате</span>
                <MoneyAmount value={data.total_to_pay} className="font-headline text-lg font-extrabold text-primary" />
              </div>
              {data.deadline && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-error/20 bg-error/10 px-4 py-3">
                  <StitchIcon name="event" className="text-error" />
                  <div>
                    <p className="text-xs font-bold text-error">Крайний срок</p>
                    <p className="text-sm font-bold text-on-surface">{data.deadline}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 text-[11px] text-on-surface-variant sm:grid-cols-2">
                {data.vat_deadline && (
                  <div className="rounded-lg bg-surface-container-high/40 px-3 py-2">
                    НДС дедлайн: <span className="font-semibold text-on-surface">{data.vat_deadline}</span>
                  </div>
                )}
                {data.fsszn_deadline && (
                  <div className="rounded-lg bg-surface-container-high/40 px-3 py-2">
                    ФСЗН дедлайн: <span className="font-semibold text-on-surface">{data.fsszn_deadline}</span>
                  </div>
                )}
              </div>
              {Array.isArray(data.assumptions) && data.assumptions.length > 0 && (
                <div className="rounded-lg border border-outline-variant/15 p-3">
                  <p className="mb-2 text-xs font-semibold text-on-surface">Допущения расчёта</p>
                  <ul className="space-y-1 text-[11px] text-on-surface-variant">
                    {data.assumptions.map((a: string, i: number) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(data.breakdown) && data.breakdown.length > 0 && (
                <div className="rounded-lg border border-outline-variant/15 p-3">
                  <p className="mb-2 text-xs font-semibold text-on-surface">Шаги расчёта</p>
                  <ul className="space-y-1 text-[11px] text-on-surface-variant">
                    {data.breakdown.map((a: string, i: number) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false} className="p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-headline text-headline-sm text-on-surface">
              <StitchIcon name="calendar_today" className="text-primary" />
              Налоговый календарь
            </h2>
            <input type="number" className="input w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="max-h-96 space-y-3 overflow-auto">
            {(calendarData?.events || []).map((event: { title: string; event_date: string }, idx: number) => (
              <div
                key={`${event.title}-${idx}`}
                className="flex items-center gap-3 rounded-lg bg-surface-container-high/50 p-3 transition-colors hover:bg-surface-container-high"
              >
                <div className="h-2 w-2 shrink-0 rounded-full bg-error" />
                <div>
                  <p className="text-sm font-medium text-on-surface">{event.title}</p>
                  <p className="text-[10px] text-on-surface-variant">{event.event_date}</p>
                </div>
              </div>
            ))}
            {!calendarData?.events?.length && <p className="text-sm text-on-surface-variant">Событий нет</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
