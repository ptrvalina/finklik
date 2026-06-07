import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workspaceApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import { useAuthStore } from '../store/authStore'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import { useOperational } from '../context/OperationalContext'
import { OperationalCommentsPanel } from '../components/workspace/OperationalCommentsPanel'

type ApprovalItem = {
  id: string
  subject_kind: string
  subject_id: string
  title: string
  note?: string | null
  status: string
  created_at?: string | null
}

const STATUS_RU: Record<string, { label: string; tone: 'pending' | 'ready' | 'action' }> = {
  pending: { label: 'На согласовании', tone: 'pending' },
  approved: { label: 'Согласовано', tone: 'ready' },
  rejected: { label: 'Отклонено', tone: 'action' },
  clarification: { label: 'Доработка', tone: 'action' },
}

const KIND_ICON: Record<string, string> = {
  payroll: 'payments',
  payment: 'account_balance',
  report: 'assignment_turned_in',
  contract: 'description',
  access: 'vpn_key',
}

function canResolveApprovals(role: string | undefined) {
  return role === 'admin' || role === 'accountant'
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ru-BY', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function statusPillClass(tone: 'pending' | 'ready' | 'action') {
  if (tone === 'ready') return 'fc-status fc-status-ready'
  if (tone === 'action') return 'fc-status fc-status-action'
  return 'fc-status fc-status-pending'
}

export default function ApprovalsPage({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const manage = canResolveApprovals(role)
  const { setNextStep } = useOperational()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey(['workspace-approvals', 'pending']),
    queryFn: () => workspaceApi.approvals({ status_filter: 'pending' }).then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const { data: historyData } = useQuery({
    queryKey: orgQueryKey(['workspace-approvals', 'history']),
    queryFn: () => workspaceApi.approvals({ status_filter: 'approved' }).then((r) => r.data),
    staleTime: 60_000,
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      workspaceApi.resolveApproval(id, { status }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgQueryKey(['workspace-approvals']) })
      void qc.invalidateQueries({ queryKey: orgQueryKey('execution-feed') })
      setNextStep({ verb: 'review', label: 'Проверить ленту работы', path: '/operations' })
    },
  })

  const items: ApprovalItem[] = data?.items ?? []
  const history: ApprovalItem[] = (historyData?.items ?? []).slice(0, 8)
  const urgentCount = items.filter((i) => i.subject_kind === 'payment' || i.subject_kind === 'report').length

  return (
    <div className={embedded ? 'pb-6' : 'fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10'}>
      {!embedded && (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Ожидают</p>
          <p className="mt-2 font-headline text-3xl font-extrabold tabular-nums text-on-surface">{items.length}</p>
          <p className="mt-1 text-sm text-on-surface-variant">Запросов</p>
        </div>
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Срочные</p>
          <p className="mt-2 font-headline text-3xl font-extrabold tabular-nums text-error">{urgentCount || items.length}</p>
          <p className="mt-1 text-sm text-on-surface-variant">До 24 часов</p>
        </div>
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Обработано</p>
          <p className="mt-2 font-headline text-3xl font-extrabold tabular-nums text-primary">{history.length}</p>
          <p className="mt-1 text-sm text-on-surface-variant">За неделю</p>
        </div>
      </div>
      )}

      {isLoading && <CardSkeleton className="min-h-[120px]" />}
      {isError && (
        <CalmErrorState
          title="Согласования недоступны"
          fallbackMessage="Не удалось загрузить список."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <PremiumEmptyState
          icon="approval"
          title="Нет ожидающих согласований"
          description="Когда появится запрос — он будет здесь."
          actions={
            <Link to="/operations" className="btn-primary mt-4 min-h-11 px-4 text-sm">
              Лента работы
            </Link>
          }
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant">Требуют решения</h2>
          <ul className="space-y-4">
            {items.map((item) => {
              const st = STATUS_RU[item.status] ?? { label: item.status, tone: 'pending' as const }
              const icon = KIND_ICON[item.subject_kind] ?? 'approval'
              return (
                <li key={item.id} className="glass-card rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-2xl">{icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={statusPillClass(st.tone)}>{st.label}</span>
                          <span className="text-[10px] font-semibold uppercase text-on-surface-variant">{item.subject_kind}</span>
                        </div>
                        <p className="mt-2 font-headline text-lg font-bold text-on-surface">{item.title}</p>
                        {item.note && <p className="mt-1 text-sm text-on-surface-variant">{item.note}</p>}
                        <p className="mt-2 text-xs text-on-surface-variant">Подано · {fmtDate(item.created_at)}</p>
                      </div>
                    </div>
                    {manage && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="btn-secondary min-h-11 px-5 text-sm font-bold"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: item.id, status: 'rejected' })}
                        >
                          Отклонить
                        </button>
                        <button
                          type="button"
                          className="btn-primary min-h-11 px-5 text-sm font-bold"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: item.id, status: 'approved' })}
                        >
                          Согласовать
                        </button>
                      </div>
                    )}
                  </div>
                  <OperationalCommentsPanel targetKind="approval_request" targetId={item.id} />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant">Недавно обработано</h2>
          <div className="glass-card overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline/40 bg-surface-container-low/60 text-left text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">Запрос</th>
                  <th className="px-4 py-3">Дата</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Тип</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const st = STATUS_RU[row.status] ?? { label: row.status, tone: 'ready' as const }
                  return (
                    <tr key={row.id} className="border-b border-outline/25 last:border-0">
                      <td className="px-4 py-3 font-medium text-on-surface">{row.title}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{fmtDate(row.created_at)}</td>
                      <td className="hidden px-4 py-3 text-on-surface-variant sm:table-cell">{row.subject_kind}</td>
                      <td className="px-4 py-3">
                        <span className={statusPillClass(st.tone)}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!manage && !isLoading && !isError && items.length > 0 && (
        <p className="mt-6 text-xs text-on-surface-variant">
          Решения по согласованиям принимает бухгалтер или администратор организации.
        </p>
      )}
    </div>
  )
}
