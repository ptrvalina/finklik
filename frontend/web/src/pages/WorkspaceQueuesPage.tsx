import { useEffect, useMemo, useState } from 'react'
import { loadWorkspaceQueuesTab, saveWorkspaceQueuesTab } from '../lib/workspaceQueuesUiSession'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { orgQueryKey } from '../lib/queryKeys'
import { pushRecentClient } from '../lib/recentClients'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'

type GlobalInbox = {
  id: string
  organization_id: string
  organization_name: string
  kind: string
  title: string
  body?: string
  priority?: string
  due_at?: string | null
}

type GlobalApproval = {
  id: string
  organization_id: string
  organization_name: string
  subject_kind: string
  title: string
  note?: string | null
}

export default function WorkspaceQueuesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const switchOrganization = useAuthStore((s) => s.switchOrganization)
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [tab, setTab] = useState<'inbox' | 'approvals'>('inbox')

  useEffect(() => {
    if (!userId) return
    const saved = loadWorkspaceQueuesTab(userId)
    if (saved) setTab(saved)
  }, [userId])
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('workspace-accountant-queues'),
    queryFn: () => workspaceApi.accountantQueues().then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const inbox: GlobalInbox[] = data?.inbox ?? []
  const approvals: GlobalApproval[] = data?.approvals ?? []

  const topInbox = inbox[0]
  const topApproval = approvals[0]

  async function openClient(orgId: string, orgName: string, path: string) {
    setActivatingId(orgId)
    try {
      pushRecentClient(orgId, orgName)
      await switchOrganization(orgId)
      await qc.cancelQueries()
      await qc.invalidateQueries()
      navigate(path)
    } finally {
      setActivatingId(null)
    }
  }

  const list = tab === 'inbox' ? inbox : approvals
  const empty = list.length === 0

  const focus = useMemo(() => {
    if (tab === 'inbox' && topInbox) {
      return {
        headline: `${inbox.length} входящих по клиентам`,
        supporting: `Сначала: ${topInbox.organization_name} — ${topInbox.title}`,
        orgId: topInbox.organization_id,
        orgName: topInbox.organization_name,
        path: '/inbox',
      }
    }
    if (tab === 'approvals' && topApproval) {
      return {
        headline: `${approvals.length} согласований ждут решения`,
        supporting: `${topApproval.organization_name}: ${topApproval.title}`,
        orgId: topApproval.organization_id,
        orgName: topApproval.organization_name,
        path: '/approvals',
      }
    }
    return null
  }, [tab, inbox.length, approvals.length, topInbox, topApproval])

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {focus && (
          <button
            type="button"
            className="btn-primary fc-btn-thumb text-sm"
            disabled={!!activatingId}
            onClick={() => void openClient(focus.orgId, focus.orgName, focus.path)}
          >
            Открыть приоритетного клиента
          </button>
        )}
        <Link to="/workspace" className="btn-secondary fc-btn-thumb text-sm">
          К клиентам
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Входящие</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{inbox.length}</p>
          <p className="text-[11px] text-on-surface-variant">По клиентам</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Согласования</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-primary sm:text-2xl">{approvals.length}</p>
          <p className="text-[11px] text-on-surface-variant">Ожидают</p>
        </div>
        <div className="glass-card rounded-2xl p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Приоритет</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
            {focus?.headline ?? 'Очереди пусты'}
          </p>
          {focus?.supporting && (
            <p className="mt-1 line-clamp-2 text-[11px] text-on-surface-variant">{focus.supporting}</p>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2 rounded-2xl border border-outline/35 bg-surface-container-low/50 p-1">
        {(
          [
            { id: 'inbox' as const, label: `Входящие (${inbox.length})` },
            { id: 'approvals' as const, label: `Согласования (${approvals.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`min-h-10 flex-1 rounded-xl px-3 text-sm font-semibold transition ${
              tab === t.id ? 'bg-primary text-primary-on shadow-sm' : 'text-on-surface-variant hover:bg-surface/80'
            }`}
            onClick={() => {
              setTab(t.id)
              if (userId) saveWorkspaceQueuesTab(userId, t.id)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <CardSkeleton className="min-h-[160px]" />}
      {isError && (
        <CalmErrorState
          title="Очереди недоступны"
          fallbackMessage="Не удалось загрузить сводку по клиентам."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && empty && (
        <PremiumEmptyState
          icon={tab === 'inbox' ? 'inbox' : 'approval'}
          title={tab === 'inbox' ? 'Входящих нет' : 'Согласований нет'}
          description="Все клиенты в спокойном состоянии — можно заняться плановой работой."
        />
      )}

      {!isLoading && !isError && !empty && (
        <ul className="space-y-3">
          {tab === 'inbox' &&
            inbox.map((item) => (
              <li key={item.id} className="glass-card rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{item.organization_name}</p>
                <p className="mt-1 font-medium text-on-surface">{item.title}</p>
                {item.body && <p className="mt-1 text-sm text-on-surface-variant">{item.body}</p>}
                <button
                  type="button"
                  className="btn-primary mt-3 min-h-10 text-sm"
                  disabled={activatingId === item.organization_id}
                  onClick={() => void openClient(item.organization_id, item.organization_name, '/inbox')}
                >
                  {activatingId === item.organization_id ? 'Переключаем…' : 'Открыть у клиента'}
                </button>
              </li>
            ))}
          {tab === 'approvals' &&
            approvals.map((item) => (
              <li key={item.id} className="glass-card rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{item.organization_name}</p>
                <p className="mt-1 font-medium text-on-surface">{item.title}</p>
                {item.note && <p className="mt-1 text-sm text-on-surface-variant">{item.note}</p>}
                <button
                  type="button"
                  className="btn-primary mt-3 min-h-10 text-sm"
                  disabled={activatingId === item.organization_id}
                  onClick={() => void openClient(item.organization_id, item.organization_name, '/approvals')}
                >
                  {activatingId === item.organization_id ? 'Переключаем…' : 'Согласовать у клиента'}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
