import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportingCalmApi } from '../../api/client'

const STATE_LABEL: Record<string, string> = {
  draft: 'Черновик',
  preparing: 'В работе',
  ready: 'Готово к проверке',
  needs_attention: 'Нужен контроль',
  submitted: 'Готово',
  overdue: 'Просрочено',
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

function severityCardClass(sev: string) {
  if (sev === 'risk') return 'border-rose-300/30 bg-rose-500/[0.05]'
  if (sev === 'attention') return 'border-amber-400/25 bg-amber-500/[0.06]'
  return 'border-emerald-400/20 bg-emerald-500/[0.05]'
}

export default function ReportingCalmHub() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['reporting-calm-overview'],
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  const validateMut = useMutation({
    mutationFn: () => reportingCalmApi.validate().then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['reporting-calm-overview'], data)
    },
  })

  const prepMut = useMutation({
    mutationFn: () => reportingCalmApi.startPreparation({}),
  })

  const data = q.data
  const score = data?.readiness?.score ?? null
  const conf = data?.readiness?.confidence ?? 'medium'

  return (
    <div className="mt-6 space-y-6">
      <div className="card-elevated rounded-3xl p-5 shadow-card ring-1 ring-white/[0.06] sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 to-transparent shadow-inner"
              style={{
                background:
                  score !== null
                    ? `conic-gradient(rgb(16 185 129 / 0.85) ${score * 3.6}deg, rgb(var(--color-surface-variant) / 0.35) 0deg)`
                    : undefined,
              }}
              aria-label="Готовность к отчётности"
            >
              <div className="flex h-[5.25rem] w-[5.25rem] flex-col items-center justify-center rounded-full bg-[rgb(var(--color-surface)/0.94)] text-center dark:bg-[rgb(var(--color-surface)/0.88)]">
                {score !== null ? (
                  <>
                    <span className="font-headline text-2xl font-extrabold text-on-surface">{score}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">готовность</span>
                  </>
                ) : (
                  <span className="text-xs text-on-surface-variant">…</span>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600/85 dark:text-emerald-400/85">
                Спокойная подготовка
              </p>
              <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">Готовность и контроль</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                {data?.ai_summary ||
                  'Загружаем сводку — FinClick учитывает журнал, сканы и обязательства, чтобы вы не гадали о сроках.'}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Уверенность системы:{' '}
                <span className="font-semibold text-on-surface">
                  {conf === 'high' ? 'высокая' : conf === 'medium' ? 'средняя' : 'нужны правки'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 lg:flex-col lg:items-stretch">
            <button
              type="button"
              className="btn-secondary min-h-11 px-5 text-sm font-bold"
              disabled={validateMut.isPending || q.isLoading}
              onClick={() => validateMut.mutate()}
            >
              {validateMut.isPending ? 'Проверка…' : 'Обновить проверку'}
            </button>
            <button
              type="button"
              className="btn-primary min-h-11 px-5 text-sm font-bold"
              disabled={prepMut.isPending}
              onClick={() => prepMut.mutate()}
            >
              {prepMut.isPending ? 'Запись…' : 'Начать подготовку'}
            </button>
          </div>
        </div>

        {data?.readiness?.blockers && data.readiness.blockers.length > 0 && (
          <div className="mt-6 rounded-2xl border border-outline-variant/25 bg-surface-container-low/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Что мешает «зелёному» статусу</p>
            <ul className="mt-2 space-y-1 text-sm text-on-surface">
              {data.readiness.blockers.map((b: { code: string; label: string }) => (
                <li key={b.code}>· {b.label}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated rounded-3xl p-5 shadow-card ring-1 ring-white/[0.05]">
          <h3 className="font-headline text-base font-bold text-on-surface">Шкала времени</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Налоги, обязательства и отправки — в одном потоке.</p>
          <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {q.isLoading && <p className="text-sm text-on-surface-variant">Загрузка…</p>}
            {!q.isLoading && data?.timeline?.length === 0 && (
              <p className="text-sm text-on-surface-variant">Пока нет событий — добавьте календарь или обязательства.</p>
            )}
            {data?.timeline?.map((item: { id: string; title: string; date: string; state: string; subtitle?: string }) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-2xl border border-outline-variant/15 bg-surface/80 px-3 py-2.5 dark:bg-black/15"
              >
                <div className="w-16 shrink-0 text-[11px] font-semibold text-on-surface-variant">{item.date}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                  {item.subtitle && <p className="text-[11px] text-on-surface-variant">{item.subtitle}</p>}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${stateChipClass(item.state)}`}>
                  {STATE_LABEL[item.state] || item.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-elevated rounded-3xl p-5 shadow-card ring-1 ring-white/[0.05]">
            <h3 className="font-headline text-base font-bold text-on-surface">Замечания</h3>
            <p className="mt-1 text-xs text-on-surface-variant">Мягкие подсказки — без тревожных уведомлений.</p>
            <div className="mt-3 space-y-2">
              {!data?.consistency_issues?.length && !q.isLoading && (
                <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90">Существенных расхождений не найдено.</p>
              )}
              {data?.consistency_issues?.map(
                (issue: { id: string; severity: string; title: string; detail: string; fix_hint: string; action_path?: string }) => (
                  <div key={issue.id} className={`rounded-2xl border px-3 py-2.5 ${severityCardClass(issue.severity)}`}>
                    <p className="text-sm font-semibold text-on-surface">{issue.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{issue.detail}</p>
                    <p className="mt-1 text-xs text-on-surface">{issue.fix_hint}</p>
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

          <div className="card-elevated rounded-3xl p-5 shadow-card ring-1 ring-white/[0.05]">
            <h3 className="font-headline text-base font-bold text-on-surface">Обязательства</h3>
            <p className="mt-1 text-xs text-on-surface-variant">Кратко — полный список в разделе «Состояние бизнеса» на главной.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {data?.obligations_preview?.map(
                (o: { id: string; obligation_type: string; amount: string; due_date: string; status: string }) => (
                  <li key={o.id} className="flex justify-between gap-2 rounded-xl bg-surface-container-high/50 px-3 py-2">
                    <span className="text-on-surface">
                      {o.obligation_type.toUpperCase()} · {o.amount} BYN
                    </span>
                    <span className="text-xs text-on-surface-variant">{o.due_date}</span>
                  </li>
                ),
              )}
              {!data?.obligations_preview?.length && !q.isLoading && (
                <li className="text-on-surface-variant">Нет записей — они появятся после расчёта налогов и обязательств в системе.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-primary/15 bg-gradient-to-r from-primary/[0.04] to-transparent px-4 py-3 text-center text-xs text-on-surface-variant sm:text-left">
        Поток: <strong className="text-on-surface">обзор → исправления → проверка → выгрузка</strong>. Разделы органов ниже — для конкретной
        отправки.
      </div>
    </div>
  )
}
