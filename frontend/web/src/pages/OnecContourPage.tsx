import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { onecApi } from '../api/client'
import { CardSkeleton } from '../components/premium'

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
      return 'border border-outline/40 bg-surface-container-high text-on-surface-variant'
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

  const status = data?.status ?? ''

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn-secondary min-h-10 text-sm"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <Icon name="refresh" className="text-lg" />
          {isFetching ? 'Обновляем…' : 'Обновить'}
        </button>
        <button type="button" className="btn-primary min-h-10 text-sm" onClick={() => pingHealth()}>
          <Icon name="monitor_heart" className="text-lg" />
          Проверить 1С
        </button>
      </div>

      {data && !isLoading && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Статус</p>
            <p className="mt-1 text-sm font-extrabold text-on-surface">{statusLabel(status)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Подключение</p>
            <p className="mt-1 text-sm font-extrabold text-on-surface">{data.connection_configured ? 'Да' : 'Нет'}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Контур</p>
            <p className="mt-1 truncate font-mono text-sm font-semibold text-primary">{data.contour_key}</p>
          </div>
        </div>
      )}

      {healthQuery.data && (
        <div className="glass-card mb-4 rounded-2xl px-4 py-3 text-sm text-on-surface">
          <span className="font-bold text-primary">Последняя проверка /onec/health:</span>{' '}
          {healthQuery.data.connected ? (
            <span className="text-secondary">связь есть</span>
          ) : (
            <span className="text-error">нет связи</span>
          )}
          {healthQuery.data.mode === 'mock' && (
            <span className="ml-2 text-on-surface-variant">(демо без endpoint)</span>
          )}
        </div>
      )}

      {isLoading && (
        <div aria-busy="true" aria-label="Загрузка реестра контура">
          <CardSkeleton className="border-outline-variant/15 bg-surface-container-low/40" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {(error as any)?.response?.data?.detail || 'Не удалось загрузить статус контура'}
        </div>
      )}

      {data && !isLoading && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(data.status)}`}>
                {statusLabel(data.status)}
              </span>
              <code className="rounded-md border border-outline/75 bg-surface-container-high px-2 py-1 font-mono text-sm text-primary">{data.contour_key}</code>
            </div>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-outline/70 pb-2">
                <dt className="text-on-surface-variant">Внешний tenant / ИБ</dt>
                <dd className="text-right text-on-surface">{data.external_tenant_id || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-outline/70 pb-2">
                <dt className="text-on-surface-variant">HTTP-подключение настроено</dt>
                <dd className="text-right font-medium text-on-surface">
                  {data.connection_configured ? (
                    <span className="text-secondary">да</span>
                  ) : (
                    <span className="text-on-surface-variant">нет</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-outline/70 pb-2">
                <dt className="text-on-surface-variant">Адрес API</dt>
                <dd className="max-w-[min(100%,280px)] truncate text-right font-mono text-xs text-on-surface-variant">
                  {data.endpoint || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-outline/70 pb-2">
                <dt className="text-on-surface-variant">Последний health (реестр)</dt>
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
                  <dt className="text-on-surface-variant">Последняя ошибка</dt>
                  <dd className="mt-1 rounded-lg bg-error/5 p-2 font-mono text-xs text-error">{data.last_error}</dd>
                </div>
              )}
            </dl>
          </div>

          <p className="text-xs text-on-surface-variant">
            Настройка URL и токена — в разделе настроек интеграции. Очередь синхронизации операций —{' '}
            <Link to="/onec-sync" className="text-primary underline-offset-2 hover:underline">
              Синхронизация 1С
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  )
}
