import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { ExecutionTaskCard } from '../execution/ExecutionTaskCard'

export default function WorkNowCard() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: orgQueryKey('execution-feed-preview'),
    queryFn: () => operationsApi.executionFeed().then((r) => r.data),
    staleTime: 45_000,
    retry: 1,
  })

  const top = data?.top_action ?? data?.items?.[0]

  if (isLoading) {
    return (
      <div className="fc-execution-card fc-skeleton-pulse h-28 p-6" />
    )
  }

  if (isError || !top) {
    return (
      <div className="fc-execution-card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Сейчас</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Открытых критичных задач нет — проверьте ленту или добавьте операции.
        </p>
        <Link to="/operations" className="btn-secondary mt-4 inline-flex min-h-10 text-sm">
          Лента работы
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Сделать сейчас</p>
        <Link to="/operations" className="text-xs font-semibold text-primary hover:underline">
          Вся лента
        </Link>
      </div>
      <ExecutionTaskCard
        item={top}
        prominent
        compact
        onOpen={(path) => (path ? navigate(path) : navigate('/operations'))}
      />
    </div>
  )
}
