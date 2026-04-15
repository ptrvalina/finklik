import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { taxApi } from '../api/client'

function fmt(n: any) { return Number(n || 0).toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

function quarterDates() {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3), sm = q * 3
  return { start: new Date(now.getFullYear(), sm, 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), sm + 3, 0).toISOString().slice(0, 10) }
}

export default function TaxesPage() {
  const defaults = quarterDates()
  const [periodStart, setPeriodStart] = useState(defaults.start)
  const [periodEnd, setPeriodEnd] = useState(defaults.end)
  const [withVat, setWithVat] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tax-calc', periodStart, periodEnd, withVat],
    queryFn: () => taxApi.calculate({ period_start: periodStart, period_end: periodEnd, with_vat: withVat }).then(r => r.data),
  })

  const { data: calendarData, isError: calendarError } = useQuery({
    queryKey: ['tax-calendar', year],
    queryFn: () => taxApi.calendar(year).then(r => r.data),
  })
  const {
    data: rulesValidation,
    refetch: refetchRulesValidation,
    isFetching: isRulesValidationFetching,
  } = useQuery({
    queryKey: ['tax-rules-validation'],
    queryFn: () => taxApi.validateRules().then(r => r.data),
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
  const fallbackReason =
    rulesValidation?.using_fallback && Array.isArray(rulesValidation.errors) && rulesValidation.errors.length > 0
      ? String(rulesValidation.errors[0])
      : null

  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">Налоги</h1>
        <p className="text-on-surface-variant mt-1">Расчёт налогов и календарь дедлайнов</p>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-low p-5 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div><label className="label">Период с</label><input type="date" className="input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
        <div><label className="label">Период по</label><input type="date" className="input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant pb-2">
          <input type="checkbox" checked={withVat} onChange={e => setWithVat(e.target.checked)} className="rounded" /> Плательщик НДС
        </label>
        <button className="btn-primary" onClick={() => refetch()}>
          <Icon name="calculate" className="text-lg" /> Пересчитать
        </button>
      </div>

      {(isError || calendarError) && (
        <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Icon name="error" className="text-lg" /> Не удалось загрузить данные
        </div>
      )}
      {rulesValidation && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            rulesValidation.ok
              ? 'bg-secondary/10 border border-secondary/20 text-secondary'
              : 'bg-error/10 border border-error/20 text-error'
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
              <span className="rounded bg-error/20 px-2 py-0.5 text-xs font-semibold text-error">
                fallback
              </span>
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
              <span className="font-semibold">Причина fallback:</span>{' '}
              {fallbackReason || 'Конфиг налоговых правил недоступен, используются встроенные значения.'}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tax summary */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <h2 className="text-lg font-bold font-headline text-on-surface mb-6 flex items-center gap-2">
            <Icon name="receipt" className="text-primary" /> Итоги периода
          </h2>
          {isLoading || !data ? (
            <div className="text-on-surface-variant text-sm">Считаем...</div>
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
                { label: 'Доходы', value: `${fmt(data.income)} BYN`, color: 'text-secondary' },
                { label: 'Расходы', value: `${fmt(data.expense)} BYN`, color: 'text-error' },
                { label: 'УСН к уплате', value: `${fmt(data.usn_to_pay)} BYN`, bold: true },
                { label: 'НДС к уплате', value: `${fmt(data.vat_to_pay)} BYN` },
                { label: 'ФСЗН (наниматель)', value: `${fmt(data.fsszn_employer_amount)} BYN` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between border-b border-outline-variant/10 pb-3 last:border-0">
                  <span className="text-sm text-on-surface-variant">{row.label}</span>
                  <span className={`text-sm ${row.bold ? 'font-bold' : ''} ${row.color || 'text-on-surface'}`}>{row.value}</span>
                </div>
              ))}
              <div className="border-t-2 border-outline-variant/20 pt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface">Итого к уплате</span>
                <span className="text-lg font-extrabold font-headline text-primary">{fmt(data.total_to_pay)} BYN</span>
              </div>
              {data.deadline && (
                <div className="mt-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Icon name="event" className="text-error" />
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
        </div>

        {/* Calendar */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold font-headline text-on-surface flex items-center gap-2">
              <Icon name="calendar_today" className="text-primary" /> Налоговый календарь
            </h2>
            <input type="number" className="input w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <div className="space-y-3 max-h-96 overflow-auto">
            {(calendarData?.events || []).map((event: any, idx: number) => (
              <div key={`${event.title}-${idx}`} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-high/50 hover:bg-surface-container-high transition-colors">
                <div className="w-2 h-2 rounded-full bg-error flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-on-surface">{event.title}</p>
                  <p className="text-[10px] text-on-surface-variant">{event.date}</p>
                </div>
              </div>
            ))}
            {!calendarData?.events?.length && <p className="text-sm text-on-surface-variant">Событий нет</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
