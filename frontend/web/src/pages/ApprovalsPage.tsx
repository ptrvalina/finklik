import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workspaceApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import { useAuthStore } from '../store/authStore'
import OperationalPage from '../components/shell/OperationalPage'
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

const STATUS_RU: Record<string, string> = {
  pending: 'ожидает',
  approved: 'согласовано',
  rejected: 'отклонено',
  clarification: 'уточнение',
}

function canResolveApprovals(role: string | undefined) {
  return role === 'admin' || role === 'accountant'
}

export default function ApprovalsPage() {
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

  return (
    <OperationalPage
      eyebrow="Сейчас"
      title="Согласования"
      description="Запросы на подтверждение операций и отчётности — решение фиксируется в аудите."
      primaryAction={
        <Link to="/operations" className="btn-primary fc-btn-thumb text-sm">
          Лента работы
        </Link>
      }
    >
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
          description="Когда появится запрос — он будет здесь. Пока проверьте ленту работы и готовность отчётности."
          actions={
            <Link to="/operations" className="btn-primary mt-4 min-h-11 px-4 text-sm">
              Лента работы
            </Link>
          }
        />
      )}
      {!isLoading && !isError && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-outline/35 bg-surface/90 px-4 py-4 sm:px-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{item.subject_kind}</p>
              <p className="mt-1 font-medium text-on-surface">{item.title}</p>
              {item.note && <p className="mt-1 text-sm text-on-surface-variant">{item.note}</p>}
              <p className="mt-2 text-xs text-on-surface-variant">
                Статус: {STATUS_RU[item.status] ?? item.status}
              </p>
              <OperationalCommentsPanel targetKind="approval_request" targetId={item.id} />
              {manage && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-outline/25 pt-3">
                  <button
                    type="button"
                    className="btn-primary min-h-10 px-3 text-xs"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: item.id, status: 'approved' })}
                  >
                    Согласовать
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-10 px-3 text-xs"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: item.id, status: 'rejected' })}
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!manage && !isLoading && !isError && items.length > 0 && (
        <p className="mt-4 text-xs text-on-surface-variant">
          Решения по согласованиям принимает бухгалтер или администратор организации.
        </p>
      )}
    </OperationalPage>
  )
}
