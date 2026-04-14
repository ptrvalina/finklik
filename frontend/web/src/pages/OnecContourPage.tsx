import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { onecApi } from '../api/client'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export type ContourStatus = {
  contour_key: string
  status: string
  external_tenant_id: string | null
  last_health_at: string | null
  last_health_ok: boolean | null
  last_error: string | null
  connection_configured: boolean
  endpoint: string | null
}

function statusLabel(s: string): string {
  switch (s) {
    case 'pending_provisioning':
      return 'Ожидает провижининга'
    case 'provisioning':
      return 'Развёртывание'
    case 'ready':
      return 'Готов'
    case 'error':
      return 'Ошибка'
    case 'suspended':
      return 'Приостановлен'
    default:
      return s
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case 'ready':
      return 'bg-secondary/10 text-secondary border border-secondary/25'
    case 'error':
      return 'bg-error/10 text-error border border-error/25'
    case 'suspended':
      return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
    default:
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
  }
}

export default function OnecContourPage() {
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['onec-contour-status'],
    queryFn: () => onecApi.contourStatus().then((r) => r.data as ContourStatus),
    refetchInterval: 60_000,
  })

  const healthQuery = useQuery({
    queryKey: ['onec-health-check'],
    queryFn: () => onecApi.health().then((r) => r.data),
    enabled: false,
  })

  async function pingHealth() {
    await healthQuery.refetch()
    await qc.invalidateQueries({ queryKey: ['onec-contour-status'] })
    await refetch()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Контур 1С</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Реестр организации в ФинКлик и состояние подключения к 1С.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary min-h-11 text-sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <Icon name="refresh" className="text-lg" />
            {isFetching ? 'Обновляем…' : 'Обновить'}
          </button>
          <button type="button" className="btn-primary min-h-11 text-sm" onClick={() => pingHealth()}>
            <Icon name="monitor_heart" className="text-lg" />
            Проверить 1С
          </button>
        </div>
      </div>

      {healthQuery.data && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
          <span className="font-bold text-teal-300">Последняя проверка /onec/health:</span>{' '}
          {healthQuery.data.connected ? (
            <span className="text-secondary">связь есть</span>
          ) : (
            <span className="text-error">нет связи</span>
          )}
          {healthQuery.data.mode === 'mock' && (
            <span className="ml-2 text-zinc-500">(демо без endpoint)</span>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Icon name="hourglass_empty" className="animate-spin" />
          Загрузка реестра…
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {(error as any)?.response?.data?.detail || 'Не удалось загрузить статус контура'}
        </div>
      )}

      {data && !isLoading && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-container-low p-5 ring-1 ring-white/[0.06]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(data.status)}`}>
                {statusLabel(data.status)}
              </span>
              <code className="rounded-md bg-black/30 px-2 py-1 font-mono text-sm text-teal-200/90">{data.contour_key}</code>
            </div>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-2">
                <dt className="text-zinc-500">Внешний tenant / ИБ</dt>
                <dd className="text-right text-on-surface">{data.external_tenant_id || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-2">
                <dt className="text-zinc-500">HTTP-подключение настроено</dt>
                <dd className="text-right font-medium text-on-surface">
                  {data.connection_configured ? (
                    <span className="text-secondary">да</span>
                  ) : (
                    <span className="text-zinc-500">нет</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-2">
                <dt className="text-zinc-500">Endpoint</dt>
                <dd className="max-w-[min(100%,280px)] truncate text-right font-mono text-xs text-zinc-400">
                  {data.endpoint || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-2">
                <dt className="text-zinc-500">Последний health (реестр)</dt>
                <dd className="text-right text-on-surface">
                  {data.last_health_at
                    ? new Date(data.last_health_at).toLocaleString('ru-BY')
                    : '—'}
                  {data.last_health_ok != null && (
                    <span className={` ml-2 ${data.last_health_ok ? 'text-secondary' : 'text-error'}`}>
                      ({data.last_health_ok ? 'ok' : 'fail'})
                    </span>
                  )}
                </dd>
              </div>
              {data.last_error && (
                <div>
                  <dt className="text-zinc-500">Последняя ошибка</dt>
                  <dd className="mt-1 rounded-lg bg-error/5 p-2 font-mono text-xs text-error">{data.last_error}</dd>
                </div>
              )}
            </dl>
          </div>

          <p className="text-xs text-zinc-600">
            Настройка URL и токена — в разделе настроек интеграции. Очередь синхронизации операций —{' '}
            <Link to="/onec-sync" className="text-teal-400 underline-offset-2 hover:underline">
              Синхронизация 1С
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  )
}
