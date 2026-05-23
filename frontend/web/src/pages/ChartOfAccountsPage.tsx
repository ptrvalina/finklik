import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../api/client'
import { terminology } from '../i18n'

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

  const { data, isLoading } = useQuery({
    queryKey: ['chart-tree'],
    queryFn: () => accountingApi.chartTree().then((r) => r.data as { classes: TreeClass[] }),
  })

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
      qc.invalidateQueries({ queryKey: ['chart-tree'] })
    },
  })

  return (
    <div className="space-y-6 p-4 pb-24">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/90">Расширенный учёт</p>
        <h1 className="mt-2 font-headline text-2xl font-bold">{terminology.nav.chartOfAccounts}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Официальные счета по Приказу Минфина №50. Субсчета создаёт организация; системные счета не удаляются.
        </p>
      </div>

      <div className="card-elevated rounded-2xl border border-outline/50 p-4">
        <p className="label mb-2">Новый субсчёт</p>
        <div className="grid gap-2 sm:grid-cols-3">
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
      </div>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Загрузка плана счетов…</p>
      ) : (
        <div className="space-y-2">
          {data?.classes?.map((cls) => (
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
                <ul className="border-t border-outline/40 px-2 pb-2">
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
    </div>
  )
}
