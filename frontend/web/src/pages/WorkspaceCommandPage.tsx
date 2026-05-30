import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { orgQueryKey } from '../lib/queryKeys'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'
import { CardSkeleton } from '../components/premium'
import { listRecentClients, pushRecentClient } from '../lib/recentClients'
import WorkspaceMissionPanel from '../components/workspace/WorkspaceMissionPanel'
import { type OrgRow, readinessLabel, workloadScore } from './workspaceTypes'

export default function WorkspaceCommandPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const switchOrganization = useAuthStore((s) => s.switchOrganization)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('workspace-accountant-overview'),
    queryFn: () => workspaceApi.accountantOverview().then((r) => r.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  })

  const organizations = useMemo(() => {
    const rows: OrgRow[] = data?.organizations ?? []
    return [...rows].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      const da = a.next_deadline?.date ?? '9999-12-31'
      const db = b.next_deadline?.date ?? '9999-12-31'
      if (da !== db) return da.localeCompare(db)
      return workloadScore(b) - workloadScore(a)
    })
  }, [data?.organizations])

  const totals = useMemo(() => {
    const apiTotals = data?.totals as Record<string, number> | undefined
    if (apiTotals) {
      return {
        inbox: apiTotals.open_inbox ?? 0,
        approvals: apiTotals.pending_approvals ?? 0,
        issues: apiTotals.attention_issues ?? 0,
        needs_review: apiTotals.needs_review ?? 0,
        pending_ocr: apiTotals.pending_ocr ?? 0,
        clients: organizations.length,
      }
    }
    let inbox = 0
    let approvals = 0
    let issues = 0
    let needs_review = 0
    let pending_ocr = 0
    for (const o of organizations) {
      inbox += o.open_inbox ?? 0
      approvals += o.pending_approvals ?? 0
      issues += o.attention_issues ?? 0
      needs_review += o.needs_review ?? 0
      pending_ocr += o.pending_ocr ?? 0
    }
    return { inbox, approvals, issues, needs_review, pending_ocr, clients: organizations.length }
  }, [data?.totals, organizations])

  const deadlines = (data?.deadlines ?? []) as Array<{
    organization_id: string
    organization_name: string
    date: string
    title: string
    kind?: string
    state?: string
    days_until?: number
  }>

  const needsAttention = organizations.filter((o) => workloadScore(o) > 0)
  const stable = organizations.filter((o) => workloadScore(o) === 0)

  const recentClients = listRecentClients()

  const pinMutation = useMutation({
    mutationFn: ({ orgId, pinned }: { orgId: string; pinned: boolean }) =>
      workspaceApi.pinMembership(orgId, pinned).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orgQueryKey('workspace-accountant-overview') }),
  })

  async function activate(orgId: string, orgName?: string, path = '/operations') {
    setActivatingId(orgId)
    try {
      if (orgName) pushRecentClient(orgId, orgName)
      await switchOrganization(orgId)
      await qc.cancelQueries()
      await qc.invalidateQueries()
      navigate(path)
    } finally {
      setActivatingId(null)
    }
  }

  const topClient = needsAttention[0]
  const urgentDeadline = deadlines.find(
    (d) => d.state === 'overdue' || (d.days_until != null && d.days_until <= 3),
  )

  const focusSupporting = urgentDeadline
    ? `Срок: ${urgentDeadline.organization_name} — ${urgentDeadline.title} (${urgentDeadline.date})`
    : topClient?.next_deadline
      ? `Срок: ${topClient.organization_name} — ${topClient.next_deadline.title}`
      : topClient
        ? `Сначала: ${topClient.organization_name} — готовность ${topClient.readiness_score ?? '—'}%`
        : undefined

  return (
    <OperationalPage
      eyebrow="Рабочее пространство"
      title="Командный центр бухгалтера"
      description="Сроки, OCR и очереди по клиентам — без CRM-перегруза, с переходом в контекст организации."
      focusStrip={
        !isLoading && (topClient || urgentDeadline) ? (
          <FocusStrip
            tone={urgentDeadline || totals.issues > 0 ? 'amber' : 'primary'}
            headline={
              urgentDeadline
                ? `Срочный срок: ${urgentDeadline.organization_name}`
                : totals.needs_review > 0
                  ? `${totals.needs_review} документов на проверке OCR`
                  : totals.issues > 0
                    ? `${totals.issues} замечаний по ${needsAttention.length} клиентам`
                    : `${totals.inbox} входящих по ${totals.clients} клиентам`
            }
            supporting={focusSupporting}
            ctaLabel={urgentDeadline ? 'Открыть клиента со сроком' : 'Открыть приоритетного клиента'}
            onCta={() => {
              if (urgentDeadline) {
                void activate(
                  urgentDeadline.organization_id,
                  urgentDeadline.organization_name,
                  urgentDeadline.kind === 'inbox' ? '/inbox' : '/calendar',
                )
              } else if (topClient) {
                void activate(topClient.organization_id, topClient.organization_name)
              }
            }}
          />
        ) : undefined
      }
      primaryAction={
        <Link to="/workspace/queues" className="btn-primary fc-btn-thumb text-sm">
          Общие очереди
        </Link>
      }
      secondaryActions={
        totals.inbox + totals.approvals > 0 ? (
          <span className="text-xs font-medium text-on-surface-variant">
            {totals.inbox} входящих · {totals.approvals} согласований
            {totals.needs_review > 0 ? ` · ${totals.needs_review} OCR` : ''}
          </span>
        ) : undefined
      }
    >
      {recentClients.length > 0 && (
        <section className="mb-6">
          <h2 className="fc-section-label mb-2">Недавние клиенты</h2>
          <div className="flex flex-wrap gap-2">
            {recentClients.map((c) => (
              <button
                key={c.organization_id}
                type="button"
                className="rounded-full border border-outline/40 bg-surface/80 px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/40"
                onClick={() => void activate(c.organization_id, c.organization_name)}
              >
                {c.organization_name}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Клиентов', value: totals.clients },
            { label: 'Входящие', value: totals.inbox },
            { label: 'Согласования', value: totals.approvals },
            { label: 'OCR проверка', value: totals.needs_review },
            { label: 'OCR обработка', value: totals.pending_ocr },
            { label: 'Замечания', value: totals.issues },
          ].map((m) => (
            <div key={m.label} className="fc-stat-tile rounded-2xl border border-outline/40 bg-surface/80 px-3 py-3 text-center">
              <p className="font-headline text-xl font-bold tabular-nums text-on-surface">{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="mt-6">
          <WorkspaceMissionPanel
            deadlines={deadlines}
            totals={{
              open_inbox: totals.inbox,
              pending_approvals: totals.approvals,
              attention_issues: totals.issues,
              needs_review: totals.needs_review,
              pending_ocr: totals.pending_ocr,
            }}
            organizations={organizations}
            activatingId={activatingId}
            onOpenClient={(orgId, orgName, path) => void activate(orgId, orgName, path)}
          />
        </div>
      )}

      {isLoading && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {isError && (
        <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-sm">
          Не удалось загрузить обзор. Проверьте роль бухгалтера и обновите страницу.
          <button type="button" className="btn-secondary ml-3 !min-h-8 text-xs" onClick={() => void refetch()}>
            Повторить
          </button>
        </div>
      )}

      {needsAttention.length > 0 && (
        <section className="mt-8">
          <h2 className="fc-section-label mb-3">Требуют внимания ({needsAttention.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {needsAttention.map((row) => (
              <OrgQueueCard
                key={row.organization_id}
                row={row}
                busy={activatingId === row.organization_id}
                onActivate={() => void activate(row.organization_id, row.organization_name)}
                onOpenScan={() => void activate(row.organization_id, row.organization_name, '/scan')}
                onTogglePin={() =>
                  pinMutation.mutate({ orgId: row.organization_id, pinned: !row.is_pinned })
                }
                pinPending={pinMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {stable.length > 0 && (
        <section className="mt-8">
          <h2 className="fc-section-label mb-3">Стабильные ({stable.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {stable.map((row) => (
              <OrgQueueCard
                key={row.organization_id}
                row={row}
                busy={activatingId === row.organization_id}
                onActivate={() => void activate(row.organization_id, row.organization_name)}
                onOpenScan={() => void activate(row.organization_id, row.organization_name, '/scan')}
                onTogglePin={() =>
                  pinMutation.mutate({ orgId: row.organization_id, pinned: !row.is_pinned })
                }
                pinPending={pinMutation.isPending}
                muted
              />
            ))}
          </div>
        </section>
      )}

      {data?.generated_at && (
        <p className="mt-6 text-center text-[11px] text-on-surface-variant">Обновлено: {String(data.generated_at)}</p>
      )}
    </OperationalPage>
  )
}

function OrgQueueCard({
  row,
  onActivate,
  onOpenScan,
  onTogglePin,
  pinPending,
  busy,
  muted,
}: {
  row: OrgRow
  onActivate: () => void
  onOpenScan?: () => void
  onTogglePin?: () => void
  pinPending?: boolean
  busy: boolean
  muted?: boolean
}) {
  const readiness = readinessLabel(row.readiness_score)
  const wl = workloadScore(row)
  const nd = row.next_deadline
  const hasOcr = (row.needs_review ?? 0) + (row.pending_ocr ?? 0) > 0

  return (
    <article
      className={`glass-card flex flex-col rounded-2xl p-4 text-left transition hover:-translate-y-1 ${
        muted ? 'opacity-60' : 'border-l-4 border-l-primary/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-headline text-base font-semibold text-on-surface">{row.organization_name}</p>
          <p className="text-xs text-on-surface-variant">УНП {row.unp}</p>
        </div>
        {onTogglePin && (
          <button
            type="button"
            className="shrink-0 rounded-full p-1 text-primary hover:bg-primary/10"
            title={row.is_pinned ? 'Открепить' : 'Закрепить'}
            disabled={pinPending}
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin()
            }}
          >
            <span className="material-symbols-outlined text-lg">{row.is_pinned ? 'push_pin' : 'push_pin'}</span>
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            readiness.tone === 'ok'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : readiness.tone === 'risk'
                ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
          }`}
        >
          {readiness.text}
          {row.readiness_score != null ? ` · ${row.readiness_score}%` : ''}
        </span>
        {wl > 0 && (
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant">
            нагрузка {wl}
          </span>
        )}
        {nd && (
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              nd.state === 'overdue' || (nd.days_until != null && nd.days_until < 0)
                ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {nd.date} · {nd.title.length > 28 ? `${nd.title.slice(0, 28)}…` : nd.title}
          </span>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] sm:grid-cols-5">
        <li className="rounded-xl bg-surface-container-low/80 py-2">
          <strong className="block text-sm text-on-surface">{row.open_inbox ?? 0}</strong>
          входящие
        </li>
        <li className="rounded-xl bg-surface-container-low/80 py-2">
          <strong className="block text-sm text-on-surface">{row.pending_approvals ?? 0}</strong>
          согласования
        </li>
        <li className="rounded-xl bg-surface-container-low/80 py-2">
          <strong className="block text-sm text-on-surface">{row.attention_issues ?? 0}</strong>
          замечания
        </li>
        <li className="rounded-xl bg-surface-container-low/80 py-2">
          <strong className="block text-sm text-on-surface">{row.needs_review ?? 0}</strong>
          OCR
        </li>
        <li className="rounded-xl bg-surface-container-low/80 py-2 col-span-3 sm:col-span-1">
          <strong className="block text-sm text-on-surface">{row.pending_ocr ?? 0}</strong>
          в обработке
        </li>
      </ul>

      {row.ai_summary && <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">{row.ai_summary}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-primary min-h-10 flex-1 text-sm" disabled={busy} onClick={onActivate}>
          {busy ? 'Переключаем…' : 'Работать с клиентом'}
        </button>
        {hasOcr && onOpenScan && (
          <button type="button" className="btn-secondary min-h-10 text-sm sm:w-auto" disabled={busy} onClick={onOpenScan}>
            Сканер
          </button>
        )}
      </div>
    </article>
  )
}
