import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { operationsApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { ExecutionTaskCard } from './ExecutionTaskCard'

type Props = {
  /** Показывать только если action_path начинается с префикса (например `/bank`). */
  pathPrefix?: string
  className?: string
}

/** Компактный top_action с ленты исполнения для контекстных экранов. */
export function ExecutionTopActionBanner({ pathPrefix, className = '' }: Props) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: orgQueryKey('execution-feed-banner'),
    queryFn: () => operationsApi.executionFeed().then((r) => r.data),
    staleTime: 45_000,
    retry: 1,
  })

  const top = data?.top_action ?? data?.items?.[0]
  if (isLoading || !top) return null
  if (pathPrefix && top.action_path && !String(top.action_path).startsWith(pathPrefix)) return null

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Следующий шаг</p>
      <ExecutionTaskCard
        item={top}
        compact
        prominent
        onOpen={(path) => (path ? navigate(path) : navigate('/operations'))}
      />
    </div>
  )
}
