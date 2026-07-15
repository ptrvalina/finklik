import { GlassCard, StatusChip, StitchIcon } from '../stitch'
import { DOC_TYPE_META } from './scannerMeta'

type QueueItem = {
  id: string
  filename: string
  confidence: number
  doc_type?: string
}

type HistoryItem = QueueItem & {
  status: string
  parsed?: { amount?: number }
  transaction_id?: string | null
}

function statusVariant(status: string): 'ready' | 'pending' | 'error' | 'neutral' {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'confirmed') return 'ready'
  if (s === 'needs_review' || s === 'review' || s === 'pending') return 'pending'
  if (s === 'error' || s === 'failed') return 'error'
  return 'neutral'
}

function statusLabel(status: string): string {
  const s = status.toLowerCase()
  if (s === 'done') return 'Готово'
  if (s === 'needs_review') return 'Проверка'
  if (s === 'error') return 'Ошибка'
  return status
}

export default function ScannerQueuePanel({
  reviewItems,
  historyItems,
  activeDocId,
  loading,
  onSelect,
  onUpload,
}: {
  reviewItems: QueueItem[]
  historyItems: HistoryItem[]
  activeDocId?: string | null
  loading?: boolean
  onSelect: (id: string) => void
  onUpload: () => void
}) {
  const recentWithoutActive = historyItems.filter((h) => h.id !== activeDocId).slice(0, 5)

  return (
    <div className="space-y-4">
      {reviewItems.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="font-headline text-sm font-semibold text-on-surface">Очередь проверки</h4>
            <StatusChip variant="pending">{reviewItems.length}</StatusChip>
          </div>
          <ul className="space-y-1.5">
            {reviewItems.slice(0, 8).map((item, idx) => {
              const active = item.id === activeDocId
              const meta = DOC_TYPE_META[item.doc_type || 'unknown']
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelect(item.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      active
                        ? 'border-primary/45 bg-primary/10 ring-1 ring-primary/25'
                        : 'border-outline-variant/35 hover:border-primary/30 hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-container-high text-[10px] font-bold tabular-nums text-on-surface-variant">
                      {idx + 1}
                    </span>
                    <StitchIcon name={meta.icon} className={`shrink-0 text-lg ${meta.color}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-on-surface">{item.filename}</span>
                      <span className="text-[10px] text-on-surface-variant">{meta.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[10px] font-bold text-on-surface-variant">{item.confidence}%</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-headline text-sm font-semibold text-on-surface">Недавние</h4>
          <button type="button" className="text-[11px] font-bold text-primary hover:underline" onClick={onUpload}>
            + Новый
          </button>
        </div>
        {recentWithoutActive.length === 0 ? (
          <p className="text-xs text-on-surface-variant">История появится после первого скана.</p>
        ) : (
          <ul className="space-y-1.5">
            {recentWithoutActive.map((item) => {
              const meta = DOC_TYPE_META[item.doc_type || 'unknown']
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelect(item.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-surface-container-low"
                  >
                    <StitchIcon name={meta.icon} className={`shrink-0 text-base ${meta.color}`} />
                    <span className="min-w-0 flex-1 truncate font-medium text-on-surface">{item.filename}</span>
                    <StatusChip variant={statusVariant(item.status)}>{statusLabel(item.status)}</StatusChip>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}
