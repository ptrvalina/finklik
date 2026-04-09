import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, bankApi, counterpartiesApi } from '../../api/client'

const STORAGE_KEY = 'finklik_onboarding_checklist_v1_dismissed'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  const { data: txData } = useQuery({
    queryKey: ['onboarding-tx-count'],
    queryFn: () => dashboardApi.getTransactions({ per_page: 1, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
  })
  const { data: bankData } = useQuery({
    queryKey: ['onboarding-bank'],
    queryFn: () => bankApi.listAccounts().then((r) => r.data),
    staleTime: 60_000,
  })
  const { data: cpData } = useQuery({
    queryKey: ['onboarding-cp'],
    queryFn: () => counterpartiesApi.list().then((r) => r.data),
    staleTime: 60_000,
  })

  const steps = useMemo(() => {
    const totalTx = Number(txData?.total ?? 0)
    const accounts = (bankData as { accounts?: unknown[] } | undefined)?.accounts ?? []
    const cps = Array.isArray(cpData) ? cpData.length : 0
    return [
      {
        id: 'tx',
        label: 'Добавьте или импортируйте операции',
        done: totalTx > 0,
        to: '/transactions',
        icon: 'receipt_long',
      },
      {
        id: 'bank',
        label: 'Привяжите расчётный счёт (мульти-банк)',
        done: accounts.length > 0,
        to: '/bank',
        icon: 'account_balance',
      },
      {
        id: 'cp',
        label: 'Добавьте контрагента в справочник',
        done: cps > 0,
        to: '/counterparties',
        icon: 'handshake',
      },
    ]
  }, [txData, bankData, cpData])

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  if (dismissed || allDone) return null

  return (
    <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-transparent p-4 ring-1 ring-white/[0.05] sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-sm font-bold text-white sm:text-base">С чего начать</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {doneCount} из {steps.length} шагов — закройте базовый онбординг за пару минут
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="tap-highlight-none flex-shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
        >
          Скрыть
        </button>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              to={s.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                s.done
                  ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20'
                  : 'bg-white/[0.04] text-zinc-200 ring-1 ring-white/[0.06] hover:bg-white/[0.08]'
              }`}
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                  s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-teal-300'
                }`}
              >
                {s.done ? <Icon name="check" className="text-xl" /> : <Icon name={s.icon} className="text-xl" />}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{s.label}</span>
              {!s.done && <Icon name="chevron_right" className="flex-shrink-0 text-zinc-500" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
