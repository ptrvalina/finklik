import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workspaceApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import { useAuthStore } from '../store/authStore'
import { CardSkeleton, PremiumEmptyState } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'
import { useOperational } from '../context/OperationalContext'
import { OperationalCommentsPanel } from '../components/workspace/OperationalCommentsPanel'

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
  snoozed: 'отложено',
  cancelled: 'отменено',
}

function canManageInbox(role: string | undefined) {
  return role === 'admin' || role === 'accountant'
}

function fmtTime(iso?: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ru-BY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function priorityTag(p?: string | null) {
  if (p === 'urgent' || p === 'high') return { label: 'URGENT', className: 'fc-status fc-status-action' }
  if (p === 'normal') return { label: 'NORMAL', className: 'fc-status fc-status-pending' }
  return null
}

export default function InboxPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const user = useAuthStore((s) => s.user)
  const manage = canManageInbox(role)
  const { setNextStep } = useOperational()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey(['workspace-inbox', 'open']),
    queryFn: () => workspaceApi.inbox({ status: 'open' }).then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      workspaceApi.patchInbox(id, { status }).then((r) => r.data),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: orgQueryKey(['workspace-inbox']) })
      void qc.invalidateQueries({ queryKey: orgQueryKey('execution-feed') })
      if (vars.status === 'done') {
        setSelectedId(null)
        setNextStep({ verb: 'review', label: 'Проверить ленту работы', path: '/operations' })
      }
    },
  })

  const items: InboxItem[] = data?.items ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || (i.body ?? '').toLowerCase().includes(q) || i.kind.toLowerCase().includes(q),
    )
  }, [items, search])

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null
  const urgent = items.filter((i) => i.priority === 'high' || i.priority === 'urgent')

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-6">
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Open</p>
          <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums">{items.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Urgent</p>
          <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums text-error">{urgent.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Priority</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">{urgent.length > 0 ? 'Needs action' : 'Calm queue'}</p>
        </div>
      </div>

      {isLoading && <CardSkeleton className="min-h-[420px]" />}
      {isError && (
        <CalmErrorState title="Входящие недоступны" fallbackMessage="Не удалось загрузить очередь." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <PremiumEmptyState
          icon="inbox"
          title="Входящих нет"
          description="Новые запросы появятся здесь."
          actions={
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="/scan" className="btn-primary min-h-11 px-4 text-sm">Сканер</Link>
              <Link to="/accounting/journal" className="btn-secondary min-h-11 px-4 text-sm">Журнал</Link>
            </div>
          }
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="grid min-h-[min(640px,70vh)] grid-cols-1 overflow-hidden rounded-2xl border border-outline/40 bg-surface lg:grid-cols-[minmax(240px,28%)_minmax(0,1fr)_minmax(240px,26%)]">
          {/* Messages list */}
          <div className="flex flex-col border-b border-outline/40 lg:border-b-0 lg:border-r">
            <div className="border-b border-outline/40 p-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">search</span>
                <input
                  className="input min-h-10 w-full rounded-xl pl-10 text-sm"
                  placeholder="Search messages…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {filtered.map((item) => {
                const active = selected?.id === item.id
                const tag = priorityTag(item.priority)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full flex-col gap-1 border-b border-outline/25 px-4 py-3 text-left transition ${
                        active ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-surface-container-high'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-on-surface">{item.title}</span>
                        <span className="shrink-0 text-[10px] text-on-surface-variant">{fmtTime(item.created_at)}</span>
                      </div>
                      {item.body && <p className="line-clamp-2 text-xs text-on-surface-variant">{item.body}</p>}
                      {tag && <span className={`mt-1 w-fit ${tag.className}`}>{tag.label}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Conversation / detail */}
          <div className="flex min-h-[320px] flex-col border-b border-outline/40 lg:border-b-0 lg:border-r">
            {selected ? (
              <>
                <div className="border-b border-outline/40 px-5 py-4">
                  <p className="font-headline text-lg font-bold text-on-surface">{selected.title}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{selected.kind} · {STATUS_RU[selected.status] ?? selected.status}</p>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-container-high px-4 py-3 text-sm text-on-surface">
                    {selected.body || 'Запрос без текста — откройте связанные материалы справа.'}
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#131b2e] px-4 py-3 text-sm text-white dark:bg-on-surface">
                    Принято в работу. Проверю документы и вернусь с результатом.
                  </div>
                  <OperationalCommentsPanel targetKind="operational_inbox" targetId={selected.id} />
                </div>
                {manage && (
                  <div className="flex gap-2 border-t border-outline/40 p-4">
                    <button
                      type="button"
                      className="btn-primary min-h-10 flex-1 text-sm"
                      disabled={patchMutation.isPending}
                      onClick={() => patchMutation.mutate({ id: selected.id, status: 'done' })}
                    >
                      Готово
                    </button>
                    <button
                      type="button"
                      className="btn-secondary min-h-10 flex-1 text-sm"
                      disabled={patchMutation.isPending}
                      onClick={() => patchMutation.mutate({ id: selected.id, status: 'snoozed' })}
                    >
                      Отложить
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-on-surface-variant">Выберите сообщение</div>
            )}
          </div>

          {/* Contextual metadata */}
          <aside className="hidden flex-col lg:flex">
            <div className="border-b border-outline/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Contextual metadata</p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {selected ? (
                <>
                  <div className="glass-card rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Status</p>
                    <p className="mt-1 text-sm font-semibold">{STATUS_RU[selected.status] ?? selected.status}</p>
                  </div>
                  {selected.due_at && (
                    <div className="glass-card rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase text-on-surface-variant">Due</p>
                      <p className="mt-1 text-sm font-semibold">{fmtTime(selected.due_at)}</p>
                    </div>
                  )}
                  <div className="glass-card rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Related</p>
                    <div className="mt-2 space-y-2">
                      {selected.linked_document_id && (
                        <Link to="/documents" className="block text-sm font-semibold text-primary hover:underline">
                          Документы
                        </Link>
                      )}
                      {selected.linked_transaction_id && (
                        <Link
                          to={`/accounting/journal?tx_id=${encodeURIComponent(selected.linked_transaction_id)}`}
                          className="block text-sm font-semibold text-primary hover:underline"
                        >
                          Операция в журнале
                        </Link>
                      )}
                      {!selected.linked_document_id && !selected.linked_transaction_id && (
                        <p className="text-xs text-on-surface-variant">Нет привязанных объектов</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">Контекст появится при выборе сообщения.</p>
              )}
              <div className="glass-card rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant">Assignee</p>
                <p className="mt-1 text-sm font-semibold">{user?.full_name ?? '—'}</p>
              </div>
              <button type="button" className="btn-secondary w-full text-sm" onClick={() => navigate('/operations')}>
                Лента работы
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
