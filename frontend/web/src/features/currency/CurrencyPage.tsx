/**
 * Курсы НБ РБ и конвертер: данные с бэкенда (кэш + автообновление на сервере).
 * Секция «для клиента»: короткие пояснения без жаргона.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fxApi, type NbrbRateRow } from '../../api/client'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

const POPULAR_FIRST = ['BYN', 'USD', 'EUR', 'RUB', 'CNY', 'PLN', 'GBP', 'TRY', 'CHF']

function sortCurrencyCodes(rows: NbrbRateRow[]): string[] {
  const apiCodes = new Set(rows.map((r) => r.code))
  const out: string[] = ['BYN']
  for (const c of POPULAR_FIRST) {
    if (c !== 'BYN' && apiCodes.has(c)) out.push(c)
  }
  for (const r of [...rows].sort((a, b) => a.code.localeCompare(b.code))) {
    if (!out.includes(r.code)) out.push(r.code)
  }
  return out
}

export default function CurrencyPage() {
  const [amountStr, setAmountStr] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('BYN')

  const ratesQuery = useQuery({
    queryKey: ['fx', 'nbrb', 'rates'],
    queryFn: () => fxApi.nbrbRates().then((r) => r.data),
    staleTime: 60_000,
    retry: 2,
  })

  const codes = useMemo(() => {
    const rows = ratesQuery.data?.rates ?? []
    return sortCurrencyCodes(rows)
  }, [ratesQuery.data?.rates])

  const amountNum = parseFloat(amountStr.replace(',', '.'))
  const amountOk = Number.isFinite(amountNum) && amountNum > 0

  const convertQuery = useQuery({
    queryKey: ['fx', 'nbrb', 'convert', amountStr, from, to],
    queryFn: () =>
      fxApi
        .nbrbConvert({
          amount: String(amountOk ? amountNum : 1),
          from,
          to,
        })
        .then((r) => r.data),
    enabled: amountOk && from !== to && !!ratesQuery.data?.rates.length,
  })

  useEffect(() => {
    if (!ratesQuery.data?.rates.length) return
    const available = new Set(ratesQuery.data.rates.map((r) => r.code))
    if (from !== 'BYN' && !available.has(from)) setFrom(available.has('USD') ? 'USD' : [...available][0]!)
    if (to !== 'BYN' && !available.has(to)) setTo('BYN')
  }, [ratesQuery.data?.rates, from, to])

  const fmtRate = (r: NbrbRateRow) => {
    const unit = parseFloat(r.byn_per_unit)
    return Number.isFinite(unit)
      ? unit.toLocaleString('ru-BY', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
      : r.byn_per_unit
  }

  const highlighted = useMemo(() => {
    const want = new Set(['USD', 'EUR', 'RUB', 'CNY', 'PLN', 'BYN'])
    const rows = ratesQuery.data?.rates ?? []
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]))
    return POPULAR_FIRST.filter((c) => c !== 'BYN' && byCode[c])
      .map((c) => byCode[c])
      .slice(0, 6)
  }, [ratesQuery.data?.rates])

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Курсы валют</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Официальные курсы <strong className="text-zinc-200">Национального банка Республики Беларусь</strong> — те же
          данные, что использует бизнес и отчётность. Сервер ФинКлик периодически обновляет справочник; конвертация идёт
          через белорусский рубль (BYN) по правилам НБ.
        </p>
      </div>

      {ratesQuery.isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <Icon name="wifi_off" className="mt-0.5 text-amber-300" />
          <div>
            <p className="font-semibold">Не удалось загрузить курсы</p>
            <p className="text-amber-200/80">Проверьте соединение с API или повторите позже.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#0f1219] p-5 ring-1 ring-white/[0.04]">
          <h2 className="flex items-center gap-2 font-headline text-lg font-bold text-white">
            <Icon name="swap_horiz" className="text-teal-300" />
            Конвертер
          </h2>
          <p className="mt-1 text-xs text-zinc-500">Введите сумму и выберите валюты — пересчёт по курсу НБ на дату ниже.</p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Сумма</label>
              <input
                type="text"
                inputMode="decimal"
                className="input"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                aria-label="Сумма"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Из</label>
                <select className="input" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!codes.length}>
                  {codes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">В</label>
                <select className="input" value={to} onChange={(e) => setTo(e.target.value)} disabled={!codes.length}>
                  {codes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {convertQuery.isError && (
            <p className="mt-3 text-sm text-red-300">
              Не удалось пересчитать. Проверьте сумму и выбранные валюты.
            </p>
          )}
          {convertQuery.data && (
            <div className="mt-5 rounded-xl bg-teal-500/10 px-4 py-3 ring-1 ring-teal-500/20">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-200/80">Результат</p>
              <p className="mt-1 font-headline text-2xl font-bold text-white">
                {parseFloat(convertQuery.data.result).toLocaleString('ru-BY', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}{' '}
                <span className="text-lg text-teal-200">{convertQuery.data.to_currency}</span>
              </p>
              {convertQuery.data.stale && (
                <p className="mt-2 text-xs text-amber-200/90">Данные могли устареть — обновите страницу чуть позже.</p>
              )}
            </div>
          )}
        </section>

        <section className="lg:col-span-3 rounded-2xl border border-white/[0.08] bg-[#0f1219] p-5 ring-1 ring-white/[0.04]">
          <h2 className="flex items-center gap-2 font-headline text-lg font-bold text-white">
            <Icon name="table_chart" className="text-violet-300" />
            Справочник курсов
          </h2>
          {ratesQuery.isLoading && (
            <p className="mt-4 text-sm text-zinc-500">
              <Icon name="hourglass_empty" className="mr-2 inline animate-spin" />
              Загружаем таблицу…
            </p>
          )}
          {ratesQuery.data && (
            <>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>
                  Дата курса:{' '}
                  <strong className="text-zinc-300">{ratesQuery.data.rates_date}</strong>
                </span>
                <span>
                  Обновлено сервером:{' '}
                  {new Date(ratesQuery.data.fetched_at).toLocaleString('ru-BY')}
                </span>
                {ratesQuery.data.refresh_interval_sec != null && (
                  <span>Автообновление: ~{Math.round(ratesQuery.data.refresh_interval_sec / 60)} мин</span>
                )}
              </div>
              {highlighted.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {highlighted.map((r) => (
                    <div
                      key={r.code}
                      className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]"
                    >
                      <span className="font-semibold text-white">{r.code}</span>
                      <span className="text-sm text-zinc-400">
                        1 {r.code} = {fmtRate(r)} BYN
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 max-h-[420px] overflow-auto rounded-lg ring-1 ring-white/[0.06]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#12151c] text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Код</th>
                      <th className="px-3 py-2">Валюта</th>
                      <th className="px-3 py-2 text-right">Единиц</th>
                      <th className="px-3 py-2 text-right">Курс (BYN)</th>
                      <th className="px-3 py-2 text-right">1 ед. = BYN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                    {[...(ratesQuery.data.rates ?? [])]
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((r) => (
                        <tr key={r.code} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono font-semibold text-teal-200">{r.code}</td>
                          <td className="px-3 py-2 text-zinc-400">{r.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.scale}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.official_rate_byn}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-white">{fmtRate(r)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
                Источник: API НБ РБ ({ratesQuery.data.source_url}). Курс устанавливается банком на рабочие дни; в выходные
                может отображаться последний рабочий курс.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
