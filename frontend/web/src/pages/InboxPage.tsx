import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'

type InboxItem = {
  id: string
  kind: string
  title: string
  body?: string | null
  status: string
  priority?: string | null
  linked_transaction_id?: string | null
  linked_document_id?: string | null
  due_at?: string | null
  created_at?: string | null
}

const STATUS_RU: Record<string, string> = {
  open: 'открыто',
  in_progress: 'в работе',
  done: 'готово',
  cancelled: 'отменено',
}

export default function InboxPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey(['workspace-inbox', 'open']),
    queryFn: () => workspaceApi.inbox({ status: 'open' }).then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const items: InboxItem[] = data?.items ?? []
  const urgent = items.filter((i) => i.priority === 'high' || i.priority === 'urgent')

  return (
    <OperationalPage
      eyebrow="Сейчас"
      title="Входящие"
      description="Запросы документов, напоминания и поручения по текущей организации — без переписки в стиле чата."
      focusStrip={
        !isLoading && urgent.length > 0 ? (
          <FocusStrip
            tone="amber"
            headline={`${urgent.length} срочных в очереди`}
            supporting="Разберите сначала их — это влияет на готовность отчётности."
            ctaLabel="К ленте работы"
            onCta={() => navigate('/operations')}
          />
        ) : undefined
      }
      primaryAction={
        <Link to="/operations" className="btn-primary fc-btn-thumb text-sm">
          Лента работы
        </Link>
      }
      secondaryActions={
        <Link to="/scan" className="btn-secondary fc-btn-thumb text-sm">
          Сканер
        </Link>
      }
    >
      {isLoading && <CardSkeleton className="min-h-[120px]" />}
      {isError && (
        <CalmErrorState
          title="Входящие недоступны"
          fallbackMessage="Не удалось загрузить очередь."
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !isError && items.length === 0 && (
        <PremiumEmptyState
          icon="inbox"
          title="Входящих нет"
          description="Новые запросы появятся здесь — от бухгалтера или из процессов учёта."
        />
      )}
      {!isLoading && !isError && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-outline/35 bg-surface/90 px-4 py-4 sm:px-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{item.kind}</p>
                  <p className="mt-1 font-medium text-on-surface">{item.title}</p>
                  {item.body && <p className="mt-1 text-sm text-on-surface-variant">{item.body}</p>}
                </div>
                <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant">
                  {STATUS_RU[item.status] ?? item.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.linked_document_id && (
                  <Link to="/documents" className="text-xs font-semibold text-primary hover:underline">
                    Документы
                  </Link>
                )}
                {item.linked_transaction_id && (
                  <Link to="/accounting/journal" className="text-xs font-semibold text-primary hover:underline">
                    Журнал
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperationalPage>
  )
}
