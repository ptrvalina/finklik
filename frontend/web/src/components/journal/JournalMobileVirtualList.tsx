import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { JOURNAL_CATEGORY_LABELS, suggestJournalCategory } from '../../lib/journalCategories'
import { txAiConfidenceLabel, txAttentionKind, txCanPost, txValidationIssues } from '../../lib/journalRowAttention'

function fmt(n: number) {
  return n.toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type SelectionApi = {
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
}

/**
 * Виртуализованный мобильный список журнала — плавный скролл при тысячах строк.
 */
export function JournalMobileVirtualList({
  items,
  focusedRowIndex,
  selection,
  onOpenRow,
  onPostDraft,
  postPendingId,
}: {
  items: Record<string, unknown>[]
  focusedRowIndex: number | null
  selection: SelectionApi
  onOpenRow: (tx: Record<string, unknown>) => void
  onPostDraft?: (id: string) => void
  postPendingId?: string | null
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  })

  if (items.length === 0) return null

  return (
    <div
      ref={parentRef}
      className="md:hidden"
      style={{
        maxHeight: 'min(62vh, 520px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      role="list"
      aria-label="Журнал операций"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const tx = items[vi.index]
          const id = String(tx.id ?? '')
          const sug = suggestJournalCategory(String(tx.description || ''))
          const aiMismatch = tx.type === 'expense' && sug.category !== (tx.category || 'other')
          const kind = txAttentionKind(tx as { status?: string; validation_issues?: string[] })
          const issueLine = txValidationIssues(tx as { validation_issues?: string[] })[0]
          const canPost = txCanPost(tx as { status?: string; validation_issues?: string[] })
          const conf = txAiConfidenceLabel(tx as { ai_category_confidence?: number })
          const accent =
            kind === 'issue'
              ? 'border-l-[3px] border-amber-500/85'
              : kind === 'draft'
                ? 'border-l-[3px] border-amber-400/85'
                : aiMismatch
                  ? 'border-l-[3px] border-emerald-500/35'
                  : ''
          const focusRing = focusedRowIndex === vi.index ? 'bg-emerald-500/[0.05]' : ''
          return (
            <div
              key={id}
              role="listitem"
              data-index={vi.index}
              className={clsx('absolute left-0 top-0 w-full border-b border-outline-variant/10', accent, focusRing)}
              style={{
                transform: `translateY(${vi.start}px)`,
                height: `${vi.size}px`,
              }}
            >
              <div className="flex gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1.5 h-4 w-4 shrink-0 rounded border-outline-variant"
                  checked={selection.isSelected(id)}
                  onChange={() => selection.toggle(id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Выбрать"
                />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenRow(tx)}>
                  <p className="text-[15px] font-semibold tabular-nums leading-none tracking-tight text-on-surface">
                    {fmt(Number(tx.amount ?? 0))}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-normal leading-snug text-on-surface-variant">
                    {String(tx.description || '—')}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-on-surface-variant/75">
                    {String(tx.transaction_date || '')} · {JOURNAL_CATEGORY_LABELS[String(tx.category)] || String(tx.category || 'Прочее')}
                    {conf ? ` · уверенность ${conf}` : ''}
                  </p>
                  {issueLine && (
                    <span className="mt-1 line-clamp-1 text-[10px] font-medium text-amber-800 dark:text-amber-200">{issueLine}</span>
                  )}
                  {!issueLine && aiMismatch && (
                    <span className="mt-1 inline-block rounded-md bg-emerald-500/8 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700/90 dark:text-emerald-300/85">
                      ИИ: {JOURNAL_CATEGORY_LABELS[sug.category]}
                    </span>
                  )}
                </button>
                {canPost && onPostDraft && (
                  <button
                    type="button"
                    className="btn-primary mt-1 min-h-9 shrink-0 self-center px-2.5 text-[10px] font-bold"
                    disabled={postPendingId === id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPostDraft(id)
                    }}
                  >
                    {postPendingId === id ? '…' : 'Провести'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
