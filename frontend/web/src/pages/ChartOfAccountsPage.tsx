import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../api/client'
import { Link } from 'react-router-dom'
import { terminology } from '../i18n'
import OperationalPage from '../components/shell/OperationalPage'
import { orgQueryKey } from '../lib/queryKeys'

type ChartTreeResponse = {
  classes: TreeClass[]
  meta?: { standard?: string; accounts_count?: number; official_subaccounts_count?: number }
  stats?: { synthetic_accounts?: number; subaccounts_org?: number }
}

type TreeClass = {
  id: number
  accounts: Array<{
    code: string
    name_ru: string
    is_off_balance: boolean
    subaccounts: Array<{ id: string; full_code: string; name_ru: string }>
  }>
}

export default function ChartOfAccountsPage() {
  const qc = useQueryClient()
  const [openClass, setOpenClass] = useState<number | null>(1)
  const [suffix, setSuffix] = useState('')
  const [subName, setSubName] = useState('')
  const [parentCode, setParentCode] = useState('60')
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('chart-tree'),
    queryFn: () => accountingApi.chartTree().then((r) => r.data as ChartTreeResponse),
    staleTime: 120_000,
  })

  const filtered = useMemo(() => {
    if (!data?.classes) return []
    const needle = q.trim().toLowerCase()
    if (!needle) return data.classes
    return data.classes
      .map((cls) => ({
        ...cls,
        accounts: cls.accounts.filter(
          (a) =>
            a.code.includes(needle) ||
            a.name_ru.toLowerCase().includes(needle) ||
            a.subaccounts.some(
              (s) => s.full_code.includes(needle) || s.name_ru.toLowerCase().includes(needle),
            ),
        ),
      }))
      .filter((c) => c.accounts.length > 0)
  }, [data?.classes, q])

  const accountCount = useMemo(
    () => filtered.reduce((n, c) => n + c.accounts.length, 0),
    [filtered],
  )

  const createSub = useMutation({
    mutationFn: () =>
      accountingApi.createSubaccount({
        parent_account_code: parentCode,
        suffix,
        name_ru: subName,
      }),
    onSuccess: () => {
      setSuffix('')
      setSubName('')
      void qc.invalidateQueries({ queryKey: orgQueryKey('chart-tree') })
    },
  })

  return (
    <OperationalPage
      eyebrow="Расширенный учёт · РБ"
      title={terminology.nav.chartOfAccounts}
      description="Полный типовой план по Постановлению Минфина №50: синтетические и забалансовые счета, официальные и организационные субсчета."
      primaryAction={
        <Link to="/accounting/fixed-assets" className="btn-primary !min-h-10 text-xs">
          {terminology.accounting.amortization}
        </Link>
      }
      secondaryActions={
        <button
          type="button"
          className="btn-secondary !min-h-10 text-xs"
          onClick={() => void qc.invalidateQueries({ queryKey: orgQueryKey('chart-tree') })}
        >
          Обновить
        </button>
      }
    >
      {data?.meta && (
        <p className="mb-4 text-xs text-on-surface-variant">
          {data.meta.standard} · счетов {data.meta.accounts_count ?? '—'} · типовых субсчетов{' '}
          {data.meta.official_subaccounts_count ?? '—'}
          {data.stats?.subaccounts_org != null ? ` · в организации ${data.stats.subaccounts_org}` : ''}
        </p>
      )}
      <div className="fc-onboarding-card">
        <label className="label">Поиск счёта или субсчёта</label>
        <input
          className="input min-h-11 rounded-xl"
          placeholder="60, материалы, 68.1…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="mt-2 text-xs text-on-surface-variant">
          Найдено счетов: <strong>{accountCount}</strong>
        </p>
      </div>

      <details className="fc-onboarding-card">
        <summary className="cursor-pointer font-semibold text-on-surface">Добавить субсчёт организации</summary>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input className="input rounded-xl" placeholder="Счёт (60)" value={parentCode} onChange={(e) => setParentCode(e.target.value)} />
          <input className="input rounded-xl" placeholder="Суффикс (1)" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
          <input className="input rounded-xl" placeholder="Название" value={subName} onChange={(e) => setSubName(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-primary mt-3 min-h-10 rounded-xl px-4 text-sm"
          disabled={!suffix || !subName || createSub.isPending}
          onClick={() => createSub.mutate()}
        >
          Добавить субсчёт
        </button>
      </details>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Загрузка плана счетов…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((cls) => (
            <div key={cls.id} className="card-elevated overflow-hidden rounded-2xl border border-outline/50">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold"
                onClick={() => setOpenClass(openClass === cls.id ? null : cls.id)}
              >
                <span>
                  Класс {cls.id} · {cls.accounts.length} сч.
                </span>
                <span className="material-symbols-outlined text-lg">
                  {openClass === cls.id ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {openClass === cls.id && (
                <ul className="max-h-[min(60vh,28rem)] overflow-y-auto border-t border-outline/40 px-2 pb-2">
                  {cls.accounts.map((acc) => (
                    <li key={acc.code} className="rounded-xl px-2 py-2 hover:bg-surface-container-high">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{acc.code}</span>
                        <span className="text-sm text-on-surface">{acc.name_ru}</span>
                        {acc.is_off_balance && (
                          <span className="text-[10px] uppercase text-amber-600">забаланс</span>
                        )}
                      </div>
                      {acc.subaccounts.length > 0 && (
                        <ul className="mt-1 space-y-0.5 pl-6 text-xs text-on-surface-variant">
                          {acc.subaccounts.map((s) => (
                            <li key={s.id}>
                              {s.full_code} — {s.name_ru}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </OperationalPage>
  )
}
