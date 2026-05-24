import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { orgQueryKey } from '../lib/queryKeys'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'
import { CardSkeleton } from '../components/premium'

type OrgRow = {
  organization_id: string
  organization_name: string
  unp: string
  is_pinned?: boolean
  readiness_score?: number | null
  open_inbox?: number
  pending_approvals?: number
  attention_issues?: number
  ai_summary?: string | null
}

function workloadScore(row: OrgRow): number {
  return (row.open_inbox ?? 0) + (row.pending_approvals ?? 0) * 2 + (row.attention_issues ?? 0) * 3
}

function readinessLabel(score: number | null | undefined): { text: string; tone: 'ok' | 'warn' | 'risk' } {
  if (score == null) return { text: 'нет данных', tone: 'warn' }
  if (score >= 80) return { text: 'готов к сдаче', tone: 'ok' }
  if (score >= 55) return { text: 'нужна доработка', tone: 'warn' }
  return { text: 'блокеры', tone: 'risk' }
}

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
      return workloadScore(b) - workloadScore(a)
    })
  }, [data?.organizations])

  const totals = useMemo(() => {
    let inbox = 0
    let approvals = 0
    let issues = 0
    for (const o of organizations) {
      inbox += o.open_inbox ?? 0
      approvals += o.pending_approvals ?? 0
      issues += o.attention_issues ?? 0
    }
    return { inbox, approvals, issues, clients: organizations.length }
  }, [organizations])

  const needsAttention = organizations.filter((o) => workloadScore(o) > 0)
  const stable = organizations.filter((o) => workloadScore(o) === 0)

  async function activate(orgId: string) {
    setActivatingId(orgId)
    try {
      await switchOrganization(orgId)
      await qc.cancelQueries()
      await qc.invalidateQueries()
      navigate('/operations')
    } finally {
      setActivatingId(null)
    }
  }

  const topClient = needsAttention[0]

  return (
    <OperationalPage
      eyebrow="Рабочее пространство"
      title="Командный центр бухгалтера"
      description="Очереди по клиентам: кто ждёт согласования, что блокирует отчётность, куда перейти одним кликом."
      focusStrip={
        !isLoading && topClient ? (
          <FocusStrip
            tone={totals.issues > 0 ? 'amber' : 'primary'}
            headline={
              totals.issues > 0
                ? `${totals.issues} замечаний по ${needsAttention.length} клиентам`
                : `${totals.inbox} входящих по ${totals.clients} клиентам`
            }
            supporting={
              topClient
                ? `Сначала: ${topClient.organization_name} — готовность ${topClient.readiness_score ?? '—'}%`
                : undefined
            }
            ctaLabel={topClient ? 'Открыть приоритетного клиента' : 'Обновить'}
            onCta={() => topClient && void activate(topClient.organization_id)}
          />
        ) : undefined
      }
    >
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Клиентов', value: totals.clients },
            { label: 'Входящие', value: totals.inbox },
            { label: 'Согласования', value: totals.approvals },
            { label: 'Замечания', value: totals.issues },
          ].map((m) => (
            <div key={m.label} className="fc-stat-tile rounded-2xl border border-outline/40 bg-surface/80 px-3 py-3 text-center">
              <p className="font-headline text-xl font-bold tabular-nums text-on-surface">{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-sm">
          Не удалось загрузить обзор. Проверьте роль бухгалтера и обновите страницу.
          <button type="button" className="btn-secondary ml-3 !min-h-8 text-xs" onClick={() => void refetch()}>
            Повторить
          </button>
        </div>
      )}

      {needsAttention.length > 0 && (
        <section>
          <h2 className="fc-section-label mb-3">Требуют внимания ({needsAttention.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {needsAttention.map((row) => (
              <OrgQueueCard
                key={row.organization_id}
                row={row}
                busy={activatingId === row.organization_id}
                onActivate={() => void activate(row.organization_id)}
              />
            ))}
          </div>
        </section>
      )}

      {stable.length > 0 && (
        <section>
          <h2 className="fc-section-label mb-3">Стабильные ({stable.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {stable.map((row) => (
              <OrgQueueCard
                key={row.organization_id}
                row={row}
                busy={activatingId === row.organization_id}
                onActivate={() => void activate(row.organization_id)}
                muted
              />
            ))}
          </div>
        </section>
      )}

      {data?.generated_at && (
        <p className="text-center text-[11px] text-on-surface-variant">Обновлено: {String(data.generated_at)}</p>
      )}
    </OperationalPage>
  )
}

function OrgQueueCard({
  row,
  onActivate,
  busy,
  muted,
}: {
  row: OrgRow
  onActivate: () => void
  busy: boolean
  muted?: boolean
}) {
  const readiness = readinessLabel(row.readiness_score)
  const wl = workloadScore(row)

  return (
    <article
      className={`flex flex-col rounded-2xl border p-4 text-left transition ${
        muted
          ? 'border-outline/35 bg-surface/60'
          : 'border-primary/25 bg-surface/95 shadow-soft hover:border-primary/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-headline text-base font-semibold text-on-surface">{row.organization_name}</p>
          <p className="text-xs text-on-surface-variant">УНП {row.unp}</p>
        </div>
        {row.is_pinned && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">★</span>
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
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
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
      </ul>

      {row.ai_summary && <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">{row.ai_summary}</p>}

      <button type="button" className="btn-primary mt-4 min-h-10 w-full text-sm" disabled={busy} onClick={onActivate}>
        {busy ? 'Переключаем…' : 'Работать с клиентом'}
      </button>
    </article>
  )
}
