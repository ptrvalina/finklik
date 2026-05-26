import type { OrgRow } from '../../pages/workspaceTypes'

type DeadlineRow = {
  organization_id: string
  organization_name: string
  date: string
  title: string
  kind?: string
  state?: string
  days_until?: number
}

type Totals = {
  open_inbox?: number
  pending_approvals?: number
  attention_issues?: number
  needs_review?: number
  pending_ocr?: number
}

type MissionPriority = {
  id: string
  label: string
  count: number
  hint: string
  tone: 'primary' | 'amber' | 'neutral'
}

function buildMissionPriorities(totals: Totals | undefined): MissionPriority[] {
  if (!totals) return []
  const rows: MissionPriority[] = []
  const review = totals.needs_review ?? 0
  const pendingOcr = totals.pending_ocr ?? 0
  const inbox = totals.open_inbox ?? 0
  const approvals = totals.pending_approvals ?? 0
  const issues = totals.attention_issues ?? 0

  if (review > 0) {
    rows.push({
      id: 'ocr-review',
      label: 'Документы на проверке',
      count: review,
      hint: 'По всем клиентам — откройте карточку и перейдите в сканер',
      tone: 'primary',
    })
  }
  if (pendingOcr > 0) {
    rows.push({
      id: 'ocr-pending',
      label: 'В обработке OCR',
      count: pendingOcr,
      hint: 'Распознавание ещё не завершено',
      tone: 'neutral',
    })
  }
  if (inbox > 0) {
    rows.push({
      id: 'inbox',
      label: 'Входящие',
      count: inbox,
      hint: 'Общие очереди или карточка клиента',
      tone: 'amber',
    })
  }
  if (approvals > 0) {
    rows.push({
      id: 'approvals',
      label: 'Согласования',
      count: approvals,
      hint: 'Решения фиксируются в аудите',
      tone: 'amber',
    })
  }
  if (issues > 0) {
    rows.push({
      id: 'issues',
      label: 'Замечания готовности',
      count: issues,
      hint: 'Риски и внимание по отчётности',
      tone: 'primary',
    })
  }
  return rows
}

function toneBorder(tone: MissionPriority['tone']) {
  if (tone === 'primary') return 'border-primary/30 bg-primary/[0.05]'
  if (tone === 'amber') return 'border-amber-400/30 bg-amber-500/[0.06]'
  return 'border-outline/35 bg-surface/90'
}

function formatDeadlineDays(days: number | undefined): string {
  if (days == null) return ''
  if (days < 0) return `просрочено ${Math.abs(days)} дн.`
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  return `через ${days} дн.`
}

function deadlineTone(state?: string, days?: number): string {
  if (state === 'overdue' || (days != null && days < 0)) {
    return 'border-red-400/35 bg-red-500/[0.06]'
  }
  if (state === 'needs_attention' || (days != null && days <= 7)) {
    return 'border-amber-400/30 bg-amber-500/[0.06]'
  }
  return 'border-outline/35 bg-surface/90'
}

export default function WorkspaceMissionPanel({
  deadlines,
  totals,
  organizations,
  onOpenClient,
  activatingId,
}: {
  deadlines: DeadlineRow[]
  totals?: Totals
  organizations: OrgRow[]
  onOpenClient: (orgId: string, orgName: string, path: string) => void
  activatingId: string | null
}) {
  const priorities = buildMissionPriorities(totals)
  const urgentDeadlines = deadlines.filter(
    (d) => d.state === 'overdue' || (d.days_until != null && d.days_until <= 14),
  )
  const upcoming = urgentDeadlines.length > 0 ? urgentDeadlines : deadlines.slice(0, 8)

  const ocrHot = organizations
    .filter((o) => (o.needs_review ?? 0) + (o.pending_ocr ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.needs_review ?? 0) +
        (b.pending_ocr ?? 0) -
        ((a.needs_review ?? 0) + (a.pending_ocr ?? 0)),
    )
    .slice(0, 5)

  if (priorities.length === 0 && upcoming.length === 0 && ocrHot.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-4">
        <p className="text-sm font-semibold text-on-surface">Операционная нагрузка в норме</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Нет срочных сроков и очередей OCR — можно работать по плану или открыть клиента из списка ниже.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {priorities.length > 0 && (
        <section aria-label="Сводные приоритеты">
          <p className="fc-section-label mb-3">Приоритеты по всем клиентам</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {priorities.map((p) => (
              <li
                key={p.id}
                className={`rounded-2xl border px-4 py-3 ${toneBorder(p.tone)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-on-surface">{p.label}</p>
                  <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold tabular-nums">
                    {p.count}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{p.hint}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-label="Ближайшие сроки">
          <p className="fc-section-label mb-3">Ближайшие сроки</p>
          <ul className="space-y-2">
            {upcoming.map((d) => (
              <li key={`${d.organization_id}-${d.date}-${d.title}`}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition hover:shadow-sm ${deadlineTone(d.state, d.days_until)}`}
                  disabled={activatingId === d.organization_id}
                  onClick={() =>
                    onOpenClient(
                      d.organization_id,
                      d.organization_name,
                      d.kind === 'inbox' ? '/inbox' : '/calendar',
                    )
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {d.organization_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-variant">{d.title}</p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] font-semibold text-on-surface-variant">
                    <p className="tabular-nums">{d.date}</p>
                    <p>{formatDeadlineDays(d.days_until)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ocrHot.length > 0 && (
        <section aria-label="Очередь OCR по клиентам">
          <p className="fc-section-label mb-3">Очередь первички</p>
          <ul className="space-y-2">
            {ocrHot.map((o) => (
              <li key={o.organization_id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-surface/95 px-4 py-3 text-left hover:border-primary/40"
                  disabled={activatingId === o.organization_id}
                  onClick={() => onOpenClient(o.organization_id, o.organization_name, '/scan')}
                >
                  <span className="truncate text-sm font-semibold text-on-surface">
                    {o.organization_name}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-on-surface-variant">
                    {(o.needs_review ?? 0) > 0 && `${o.needs_review} на проверке`}
                    {(o.needs_review ?? 0) > 0 && (o.pending_ocr ?? 0) > 0 ? ' · ' : ''}
                    {(o.pending_ocr ?? 0) > 0 && `${o.pending_ocr} в обработке`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
