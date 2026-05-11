import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAuthStore } from '../store/authStore'

/** Командный центр бухгалтера: несколько клиентов без CRM-шума. */
export default function WorkspaceCommandPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const switchOrganization = useAuthStore((s) => s.switchOrganization)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workspace', 'accountantOverview'],
    queryFn: () => workspaceApi.accountantOverview().then((r) => r.data),
  })

  async function activate(orgId: string) {
    await switchOrganization(orgId)
    await qc.invalidateQueries()
    await refetch()
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Рабочее пространство</p>
        <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
          Клиенты и очереди
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
          Спокойный обзор компаний, к которым у вас есть доступ: готовность отчётности, входящие задачи и согласования.
          Выберите клиента — контекст переключится для всего интерфейса.
        </p>
      </header>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-36 animate-pulse rounded-3xl border border-outline/40 bg-surface-container-low/80"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-500/[0.06] px-5 py-4 text-sm text-on-surface">
          Не удалось загрузить обзор. Проверьте права (роль бухгалтер) и попробуйте обновить страницу.
        </div>
      )}

      {data?.organizations && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.organizations.map((row: any) => (
            <button
              key={row.organization_id}
              type="button"
              onClick={() => void activate(row.organization_id)}
              className="group flex flex-col rounded-3xl border border-outline/50 bg-surface/95 p-5 text-left shadow-soft transition hover:border-primary/35 hover:shadow-float dark:border-outline/35 dark:bg-[rgb(var(--color-surface)/0.92)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-headline text-base font-semibold text-on-surface">{row.organization_name}</p>
                  <p className="truncate text-xs text-on-surface-variant">УНП {row.unp}</p>
                </div>
                {row.is_pinned && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    закреплён
                  </span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-surface-container-low/90 py-2 dark:bg-white/[0.04]">
                  <p className="text-lg font-bold text-on-surface">{row.readiness_score ?? '—'}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">готовность</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low/90 py-2 dark:bg-white/[0.04]">
                  <p className="text-lg font-bold text-on-surface">{row.open_inbox ?? 0}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">входящие</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low/90 py-2 dark:bg-white/[0.04]">
                  <p className="text-lg font-bold text-on-surface">{row.pending_approvals ?? 0}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">согласования</p>
                </div>
              </div>
              {row.ai_summary && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{row.ai_summary}</p>
              )}
              <p className="mt-4 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                Открыть этот клиент →
              </p>
            </button>
          ))}
        </div>
      )}

      {data?.generated_at && (
        <p className="mt-8 text-center text-[11px] text-on-surface-variant">Обновлено: {String(data.generated_at)}</p>
      )}
    </div>
  )
}
