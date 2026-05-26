import { useEffect, useMemo, useState } from 'react'
import { loadWorkspaceQueuesTab, saveWorkspaceQueuesTab } from '../lib/workspaceQueuesUiSession'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { orgQueryKey } from '../lib/queryKeys'
import { pushRecentClient } from '../lib/recentClients'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'
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
    <OperationalPage
      eyebrow="Рабочее пространство"
      title="Общие очереди"
      description="Входящие и согласования по всем клиентам — переключение организации сохраняет контекст внутри клиента."
      focusStrip={
        focus ? (
          <FocusStrip
            tone="primary"
            headline={focus.headline}
            supporting={focus.supporting}
            ctaLabel="Открыть приоритетного клиента"
            onCta={() => void openClient(focus.orgId, focus.orgName, focus.path)}
          />
        ) : undefined
      }
      primaryAction={
        <Link to="/workspace" className="btn-secondary fc-btn-thumb text-sm">
          К клиентам
        </Link>
      }
    >
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
              <li key={item.id} className="rounded-2xl border border-outline/35 bg-surface/90 p-4">
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
              <li key={item.id} className="rounded-2xl border border-outline/35 bg-surface/90 p-4">
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
    </OperationalPage>
  )
}
