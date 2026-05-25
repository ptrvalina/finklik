import { useQuery } from '@tanstack/react-query'
import { opsApi } from '../api/client'

export default function OpsDiagnosticsPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ops-diagnostics'],
    queryFn: () => opsApi.diagnostics().then((r) => r.data),
    retry: false,
  })

  if (isLoading) {
    return <p className="p-6 text-sm text-on-surface-variant">Загрузка диагностики…</p>
  }

  if (error) {
    return (
      <div className="page-section m-6 border border-error/30 bg-error/5 p-5">
        <p className="text-sm text-error">Доступ только для администратора.</p>
      </div>
    )
  }

  return (
    <div className="fc-page-shell p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="page-heading">Операционная диагностика</h1>
          <p className="text-sm text-on-surface-variant">OCR, целостность, стартовые проверки</p>
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={() => refetch()} disabled={isFetching}>
          Обновить
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="page-section p-4">
          <h2 className="mb-2 text-sm font-bold">Старт</h2>
          <pre className="max-h-64 overflow-auto rounded-lg bg-surface-container-low p-3 text-[11px]">
            {JSON.stringify(data?.startup, null, 2)}
          </pre>
        </section>
        <section className="page-section p-4">
          <h2 className="mb-2 text-sm font-bold">Целостность</h2>
          <p className={`mb-2 text-xs font-bold ${data?.integrity?.ok ? 'text-emerald-600' : 'text-amber-500'}`}>
            {data?.integrity?.ok ? 'Готово' : 'Есть замечания'}
          </p>
          <ul className="space-y-1 text-xs text-on-surface-variant">
            {(data?.integrity?.checks ?? []).map((c: { name: string; ok: boolean; detail?: string }) => (
              <li key={c.name}>
                {c.ok ? '✓' : '⚠'} {c.name}: {c.detail || '—'}
              </li>
            ))}
          </ul>
        </section>
        <section className="page-section p-4">
          <h2 className="mb-2 text-sm font-bold">Распознавание</h2>
          <p className="text-sm">В очереди проверки: {data?.ocr?.needs_review_queue ?? 0}</p>
        </section>
        <section className="page-section p-4">
          <h2 className="mb-2 text-sm font-bold">Очереди</h2>
          <p className="text-xs text-on-surface-variant">{data?.queues?.note}</p>
        </section>
      </div>
    </div>
  )
}
