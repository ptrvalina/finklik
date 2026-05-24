import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import OperationalPage from '../components/shell/OperationalPage'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'

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
}

export default function ApprovalsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey(['workspace-approvals', 'pending']),
    queryFn: () => workspaceApi.approvals({ status_filter: 'pending' }).then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
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
          description="Когда появится запрос — он будет здесь, без лишних уведомлений."
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
            </li>
          ))}
        </ul>
      )}
    </OperationalPage>
  )
}
