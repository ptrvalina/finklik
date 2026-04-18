import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { onecApi } from '../api/client'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

const STATUS_OPTIONS = ['', 'pending', 'running', 'retry', 'success', 'failed'] as const

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'В очереди'
    case 'running': return 'В работе'
    case 'retry': return 'Повтор'
    case 'success': return 'Успешно'
    case 'failed': return 'Ошибка'
    default: return status || '—'
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'success': return 'bg-secondary/10 text-secondary border border-secondary/20'
    case 'failed': return 'bg-error/10 text-error border border-error/20'
    case 'running':
    case 'retry':
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    default:
      return 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
  }
}

export default function OnecSyncPage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['onec-sync-jobs-page', status],
    queryFn: () => onecApi.listSyncJobs(status || undefined).then((r) => r.data),
    refetchInterval: 5000,
  })

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => onecApi.retrySyncJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onec-sync-jobs-page'] })
      qc.invalidateQueries({ queryKey: ['onec-sync-jobs'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const jobs = data?.jobs ?? []
  const stats = useMemo(() => {
    const result: Record<string, number> = { pending: 0, running: 0, retry: 0, success: 0, failed: 0 }
    for (const j of jobs) result[j.status] = (result[j.status] || 0) + 1
    return result
  }, [jobs])

  return (
    <div className="max-w-7xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">Синхронизация 1С</h1>
          <p className="text-sm text-zinc-500">Очередь задач, статусы, ошибки и ручной retry</p>
        </div>
        <div className="w-full sm:w-56">
          <label className="label">Фильтр по статусу</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? statusLabel(s) : 'Все статусы'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['pending', 'running', 'retry', 'success', 'failed'] as const).map((s) => (
          <div key={s} className="rounded-xl bg-surface-container-low p-4 border border-zinc-200/80 shadow-soft">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{statusLabel(s)}</p>
            <p className="mt-1 text-2xl font-extrabold text-on-surface">{stats[s] || 0}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-low border border-zinc-200/80 shadow-soft">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-zinc-500">Загрузка...</div>
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">Задачи не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="bg-surface-container-high/40 text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="px-4 py-3 text-left">Транзакция</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-left">Попытки</th>
                  <th className="px-4 py-3 text-left">Ошибка</th>
                  <th className="px-4 py-3 text-left">Внешний ID</th>
                  <th className="px-4 py-3 text-left">Создано</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {jobs.map((job: any) => (
                  <tr key={job.id} className="hover:bg-surface-container-high/30">
                    <td className="px-4 py-3 text-xs text-on-surface">{job.transaction_id}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{job.attempts}/{job.max_attempts}</td>
                    <td className="max-w-[320px] truncate px-4 py-3 text-xs text-error">{job.last_error || '—'}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{job.external_id || '—'}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {job.created_at ? new Date(job.created_at).toLocaleString('ru-BY') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(job.status === 'failed' || job.status === 'success') && (
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1 !text-xs text-amber-400"
                          disabled={retryMutation.isPending}
                          onClick={() => retryMutation.mutate(job.id)}
                        >
                          <Icon name="refresh" className="text-sm" /> Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
