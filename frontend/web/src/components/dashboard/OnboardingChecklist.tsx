import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, scannerApi, businessOsApi, reportingCalmApi, teamApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { hasSeenOperations } from '../../lib/pilotProgress'

const STORAGE_KEY = 'finklik_onboarding_checklist_v2_dismissed'

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
    queryKey: orgQueryKey('onboarding-tx-count'),
    queryFn: () => dashboardApi.getTransactions({ per_page: 1, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: txSample } = useQuery({
    queryKey: orgQueryKey('onboarding-tx-categories'),
    queryFn: () => dashboardApi.getTransactions({ per_page: 80, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
    enabled: Number(txData?.total ?? 0) > 0,
  })

  const { data: scanList } = useQuery({
    queryKey: orgQueryKey('onboarding-scan-docs'),
    queryFn: () => scannerApi.list({ limit: 1, offset: 0 }).then((r) => r.data as unknown[]),
    staleTime: 60_000,
    retry: false,
  })

  const { data: businessState, isFetched: stateFetched, isError: stateError } = useQuery({
    queryKey: orgQueryKey('onboarding-business-state'),
    queryFn: () => businessOsApi.getState().then((r) => r.data),
    staleTime: 120_000,
    retry: false,
  })

  const { data: calmOverview, isFetched: calmFetched } = useQuery({
    queryKey: orgQueryKey('onboarding-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 120_000,
    retry: false,
  })

  const { data: bizProfile, isFetched: profileFetched } = useQuery({
    queryKey: orgQueryKey('business-profile'),
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data),
    staleTime: 120_000,
    retry: false,
  })

  const steps = useMemo(() => {
    const totalTx = Number(txData?.total ?? 0)
    const items = (txSample?.items ?? []) as { category?: string }[]
    const categorized = items.some((t) => t.category && t.category !== 'other')
    const hasScan = Array.isArray(scanList) && scanList.length > 0
    // Не блокируем чеклист, если эндпоинт ещё не развёрнут или ответил ошибкой — шаг считается «мы попробовали загрузить снимок».
    const hasState = stateFetched && (businessState != null || stateError)
    const calmOk =
      calmFetched &&
      calmOverview != null &&
      calmOverview.readiness != null &&
      calmOverview.readiness.score != null &&
      calmOverview.readiness.score !== undefined

    const profileDone = profileFetched && Boolean(bizProfile?.business_profile_completed)

    const seenOps = hasSeenOperations()

    return [
      {
        id: 'profile',
        label: 'Заполните профиль бизнеса (ОКЭД)',
        hint: 'Около 2 минут — для подсказок и отчётности',
        done: profileDone,
        to: '/onboarding/business-profile',
        icon: 'domain',
      },
      {
        id: 'ops',
        label: 'Откройте ленту работы',
        hint: 'Что делать сейчас — без лишних экранов',
        done: seenOps,
        to: '/operations',
        icon: 'bolt',
      },
      {
        id: 'tx',
        label: 'Импортируйте или введите операции',
        hint: 'Журнал — основа дальнейших шагов',
        done: totalTx > 0,
        to: '/accounting/journal',
        icon: 'receipt_long',
      },
      {
        id: 'scan',
        label: 'Загрузите первый документ (скан или фото)',
        hint: 'Распознавание подставит сумму и дату',
        done: hasScan,
        to: '/scan',
        icon: 'document_scanner',
      },
      {
        id: 'cat',
        label: 'Расставьте категории в журнале',
        hint: 'Хотя бы одна операция не «Прочее»',
        done: totalTx > 0 && categorized,
        to: '/accounting/journal',
        icon: 'category',
      },
      {
        id: 'state',
        label: 'Посмотрите финансовое состояние',
        hint: 'Короткий снимок по организации',
        done: hasState,
        to: '/',
        icon: 'monitoring',
      },
      {
        id: 'reporting',
        label: 'Оцените готовность к отчётности',
        hint: 'Спокойный чеклист без сюрпризов',
        done: calmOk,
        to: '/reports',
        icon: 'assignment_turned_in',
      },
    ]
  }, [txData, txSample, scanList, businessState, stateFetched, stateError, calmOverview, calmFetched, bizProfile, profileFetched])

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
  const progressPct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

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
    <div className="fc-calm-surface border-primary/20 p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-sm font-bold text-on-surface sm:text-base">Первые 15 минут</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {doneCount} из {steps.length} — спокойный старт без «настройки как в ERP»
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="tap-highlight-none flex-shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          Скрыть
        </button>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-surface-container-high" aria-hidden>
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-premium"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              to={s.to}
              className={`fc-btn-thumb flex min-h-[var(--fc-touch-min)] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                s.done
                  ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'border border-outline/75 bg-surface text-on-surface hover:border-primary/30 hover:bg-primary/5 dark:border-outline/45 dark:text-on-surface'
              }`}
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                  s.done ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-primary/10 text-primary'
                }`}
              >
                {s.done ? <Icon name="check" className="text-xl" /> : <Icon name={s.icon} className="text-xl" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">{s.label}</span>
                {!s.done && s.hint ? <span className="mt-0.5 block text-[11px] text-on-surface-variant">{s.hint}</span> : null}
              </span>
              {!s.done && <Icon name="chevron_right" className="flex-shrink-0 text-on-surface-variant" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
