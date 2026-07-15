import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { accountingApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import MoneyAmount from '../components/ui/MoneyAmount'

const METHODS: Record<string, string> = {
  straight_line: 'Линейный',
}

export default function FixedAssetsPage() {
  const qc = useQueryClient()
  const now = new Date()
  const [form, setForm] = useState({
    inventory_number: '',
    name: '',
    purchase_date: now.toISOString().slice(0, 10),
    purchase_amount: '',
    useful_life_months: '60',
    salvage_value: '0',
  })
  const [runYear, setRunYear] = useState(now.getFullYear())
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1)
  const [msg, setMsg] = useState<string | null>(null)

  const assetsKey = orgQueryKey('fixed-assets')
  const amortKey = orgQueryKey('amortization-entries')

  const { data: assetsData, isLoading } = useQuery({
    queryKey: assetsKey,
    queryFn: () => accountingApi.listFixedAssets().then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: amortData } = useQuery({
    queryKey: amortKey,
    queryFn: () => accountingApi.listAmortization(36).then((r) => r.data),
    staleTime: 30_000,
  })

  const createAsset = useMutation({
    mutationFn: () =>
      accountingApi.createFixedAsset({
        inventory_number: form.inventory_number.trim(),
        name: form.name.trim(),
        purchase_date: form.purchase_date,
        purchase_amount: Number(form.purchase_amount),
        useful_life_months: Number(form.useful_life_months),
        depreciation_method: 'straight_line',
        salvage_value: Number(form.salvage_value || 0),
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, inventory_number: '', name: '', purchase_amount: '' }))
      void qc.invalidateQueries({ queryKey: assetsKey })
      setMsg('Основное средство добавлено в реестр.')
    },
    onError: () => setMsg('Не удалось сохранить — проверьте инвентарный номер и сумму.'),
  })

  const disposeAsset = useMutation({
    mutationFn: (id: string) => accountingApi.patchFixedAsset(id, { is_active: false }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assetsKey })
      setMsg('ОС отмечено как выбывшее.')
    },
    onError: () => setMsg('Не удалось обновить статус ОС.'),
  })

  const runAmort = useMutation({
    mutationFn: () => accountingApi.runAmortization(runYear, runMonth),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: amortKey })
      void qc.invalidateQueries({ queryKey: orgQueryKey('chart-tree') })
      setMsg(`Начислена амортизация: ${res.data?.created ?? 0} проводок за ${runMonth}.${runYear}.`)
    },
    onError: () => setMsg('Начисление не выполнено — возможно период уже закрыт или нет активных ОС.'),
  })

  const items = assetsData?.items ?? []
  const active = items.filter((a: { is_active: boolean }) => a.is_active)
  const amortItems = amortData?.items ?? []
  const totalBookValue = active.reduce((s: number, a: { purchase_amount?: string | number }) => s + Number(a.purchase_amount || 0), 0)

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to="/settings" className="btn-secondary !min-h-10 text-xs">
          Настройки учёта
        </Link>
        <Link to="/accounting/journal" className="btn-primary !min-h-10 text-xs">
          Журнал
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Активные</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{active.length}</p>
          <p className="text-[11px] text-on-surface-variant">В реестре</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Стоимость</p>
          <p className="mt-1 font-headline text-lg font-extrabold tabular-nums text-primary sm:text-xl">
            <MoneyAmount value={totalBookValue} emptyAsZero className="text-inherit" />
          </p>
          <p className="text-[11px] text-on-surface-variant">баланс</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Начисления</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{amortItems.length}</p>
          <p className="text-[11px] text-on-surface-variant">Последние записи</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Период</p>
          <p className="mt-1 font-headline text-base font-extrabold tabular-nums text-on-surface sm:text-lg">
            {String(runMonth).padStart(2, '0')}.{runYear}
          </p>
          <p className="text-[11px] text-primary">Линейная амортизация</p>
        </div>
      </div>

      {active.length === 0 && (
        <div className="glass-card mb-4 rounded-2xl border border-primary/20 p-4">
          <p className="text-sm font-semibold text-on-surface">Добавьте первое основное средство</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Укажите инвентарный номер, стоимость и срок полезного использования.
          </p>
          <button
            type="button"
            className="btn-primary mt-3 text-sm"
            onClick={() => document.getElementById('fa-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            К форме
          </button>
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-on-surface">{msg}</div>
      )}

      <details id="fa-form" className="fc-onboarding-card" open={items.length === 0}>
        <summary className="cursor-pointer font-semibold text-on-surface">Новое основное средство</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="input rounded-xl"
            placeholder="Инв. №"
            value={form.inventory_number}
            onChange={(e) => setForm({ ...form, inventory_number: e.target.value })}
          />
          <input
            className="input rounded-xl sm:col-span-2"
            placeholder="Наименование"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="date"
            className="input rounded-xl"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
          />
          <input
            className="input rounded-xl"
            placeholder="Стоимость"
            inputMode="decimal"
            value={form.purchase_amount}
            onChange={(e) => setForm({ ...form, purchase_amount: e.target.value })}
          />
          <input
            className="input rounded-xl"
            placeholder="Срок, мес."
            inputMode="numeric"
            value={form.useful_life_months}
            onChange={(e) => setForm({ ...form, useful_life_months: e.target.value })}
          />
          <input
            className="input rounded-xl"
            placeholder="Ликвидационная стоимость"
            inputMode="decimal"
            value={form.salvage_value}
            onChange={(e) => setForm({ ...form, salvage_value: e.target.value })}
          />
        </div>
        <button
          type="button"
          className="btn-primary mt-4 min-h-11 rounded-xl px-5 text-sm"
          disabled={createAsset.isPending || !form.inventory_number || !form.name || !form.purchase_amount}
          onClick={() => createAsset.mutate()}
        >
          {createAsset.isPending ? 'Сохраняем…' : 'Добавить в реестр'}
        </button>
      </details>

      <section className="fc-onboarding-card">
        <p className="fc-section-label mb-3">Начисление за период</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Год</label>
            <input
              type="number"
              className="input min-h-10 w-24 rounded-xl"
              value={runYear}
              onChange={(e) => setRunYear(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Месяц</label>
            <input
              type="number"
              min={1}
              max={12}
              className="input min-h-10 w-20 rounded-xl"
              value={runMonth}
              onChange={(e) => setRunMonth(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            className="btn-primary min-h-11 rounded-xl px-5 text-sm"
            disabled={runAmort.isPending || active.length === 0}
            onClick={() => runAmort.mutate()}
          >
            {runAmort.isPending ? 'Начисляем…' : 'Начислить амортизацию'}
          </button>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          Метод: {METHODS.straight_line}. Дт 20 (или затраты) · Кт 02 — по настройкам сервиса амортизации.
        </p>
      </section>

      <section>
        <h2 className="fc-section-label mb-3">Реестр ({items.length})</h2>
        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Реестр пуст — добавьте ОС выше.</p>
        ) : (
          <div className="space-y-2">
            {items.map((a: any) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-2xl border border-outline/40 bg-surface/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface">
                    <span className="font-mono text-xs text-on-surface-variant">{a.inventory_number}</span> · {a.name}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Ввод {a.purchase_date} · <MoneyAmount value={a.purchase_amount} className="inline-flex" /> · {a.useful_life_months} мес. · счета{' '}
                    {a.asset_account}/{a.depreciation_account}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      a.is_active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {a.is_active ? 'активно' : 'выбыло'}
                  </span>
                  {a.is_active && (
                    <button
                      type="button"
                      className="btn-ghost !min-h-8 text-xs text-on-surface-variant"
                      disabled={disposeAsset.isPending}
                      onClick={() => disposeAsset.mutate(a.id)}
                    >
                      Списать
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {amortItems.length > 0 && (
        <section>
          <h2 className="fc-section-label mb-3">Последние начисления</h2>
          <ul className="divide-y divide-outline/30 rounded-2xl border border-outline/40">
            {amortItems.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 truncate text-on-surface">{e.asset_name || e.fixed_asset_id}</span>
                <span className="shrink-0 text-on-surface-variant">
                  {String(e.period_month).padStart(2, '0')}.{e.period_year}
                </span>
                <MoneyAmount value={e.amount} className="inline-flex shrink-0 font-semibold text-on-surface" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
