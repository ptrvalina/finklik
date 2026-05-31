import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { opsApi } from '../api/client'

export default function OpsDiagnosticsPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ops-diagnostics'],
    queryFn: () => opsApi.diagnostics().then((r) => r.data),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="fc-page-shell p-6">
        <p className="text-sm text-on-surface-variant">Загрузка диагностики…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fc-page-shell p-6">
        <div className="glass-card rounded-2xl border border-error/30 bg-error/5 p-5">
          <p className="text-sm text-error">Доступ только для администратора.</p>
          <Link to="/operations" className="btn-secondary mt-3 inline-flex text-sm">
            Лента работы
          </Link>
        </div>
      </div>
    )
  }

  const ocrQueue = data?.ocr?.needs_review_queue ?? 0
  const integrityOk = data?.integrity?.ok ?? false
  const checkCount = (data?.integrity?.checks ?? []).length

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Обновляем…' : 'Обновить'}
        </button>
        <Link to="/operations?trust=1" className="btn-primary text-sm">
          Лента работы
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">OCR</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{ocrQueue}</p>
          <p className="text-[11px] text-on-surface-variant">В очереди проверки</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Целостность</p>
          <p className={`mt-1 font-headline text-base font-extrabold sm:text-lg ${integrityOk ? 'text-primary' : 'text-amber-600'}`}>
            {integrityOk ? 'Готово' : 'Замечания'}
          </p>
          <p className="text-[11px] text-on-surface-variant">{checkCount} проверок</p>
        </div>
        <div className="glass-card rounded-2xl p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Диагностика</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">OCR, целостность, стартовые проверки</p>
          <p className="text-[11px] text-primary">Контур администратора</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-card rounded-2xl p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-bold text-on-surface">Старт</h2>
          <pre className="max-h-64 overflow-auto rounded-xl bg-surface-container-low p-3 text-[11px]">
            {JSON.stringify(data?.startup, null, 2)}
          </pre>
        </section>
        <section className="glass-card rounded-2xl p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-bold text-on-surface">Целостность</h2>
          <ul className="space-y-1 text-xs text-on-surface-variant">
            {(data?.integrity?.checks ?? []).map((c: { name: string; ok: boolean; detail?: string }) => (
              <li key={c.name}>
                {c.ok ? '✓' : '⚠'} {c.name}: {c.detail || '—'}
              </li>
            ))}
          </ul>
        </section>
        <section className="glass-card rounded-2xl p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-bold text-on-surface">Распознавание</h2>
          <p className="text-sm text-on-surface">В очереди проверки: {ocrQueue}</p>
        </section>
        <section className="glass-card rounded-2xl p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-bold text-on-surface">Очереди</h2>
          <p className="text-xs text-on-surface-variant">{data?.queues?.note}</p>
        </section>
      </div>
    </div>
  )
}
