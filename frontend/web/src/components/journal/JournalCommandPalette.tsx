import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

type Tx = { id: string; description?: string | null; transaction_date?: string; amount?: number | string }

type Props = {
  open: boolean
  onClose: () => void
  transactions: Tx[]
  query: string
  onQueryChange: (q: string) => void
  onPickTransaction: (tx: Tx) => void
  onGoCapture: () => void
  onClearFilters: () => void
  /** Быстрый расход: тип + фокус формы ввода */
  onQuickExpense?: () => void
  /** Быстрый доход */
  onQuickIncome?: () => void
}

export function JournalCommandPalette({
  open,
  onClose,
  transactions,
  query,
  onQueryChange,
  onPickTransaction,
  onGoCapture,
  onClearFilters,
  onQuickExpense,
  onQuickIncome,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return transactions.slice(0, 12)
    return transactions
      .filter((t) => {
        const hay = `${t.description || ''} ${t.transaction_date || ''}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 12)
  }, [transactions, query])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-3 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Командная палитра журнала"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="fc-premium-surface max-h-[70vh] w-full max-w-lg overflow-hidden rounded-3xl shadow-lift ring-1 ring-white/[0.08]">
        <div className="border-b border-outline-variant/15 px-4 py-3">
          <input
            ref={inputRef}
            className="input min-h-12 w-full rounded-xl border-none bg-transparent text-base outline-none ring-0 focus:ring-0"
            placeholder="Поиск операции или действие…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <p className="mt-2 text-[10px] text-on-surface-variant">Enter — открыть строку · Esc — закрыть</p>
        </div>
        <div className="max-h-[48vh] overflow-y-auto px-2 py-2 text-sm">
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Действия</p>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-500/[0.08]"
            onClick={() => {
              onGoCapture()
              onClose()
            }}
          >
            <span className="material-symbols-outlined text-emerald-500">edit_note</span>
            <span className="font-medium">Новая операция (как N)</span>
          </button>
          {onQuickExpense && (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-500/[0.08]"
              onClick={() => {
                onQuickExpense()
                onClose()
              }}
            >
              <span className="material-symbols-outlined text-red-400">north_east</span>
              <span className="font-medium">Быстрый расход</span>
            </button>
          )}
          {onQuickIncome && (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-500/[0.08]"
              onClick={() => {
                onQuickIncome()
                onClose()
              }}
            >
              <span className="material-symbols-outlined text-emerald-500">south_west</span>
              <span className="font-medium">Быстрый доход</span>
            </button>
          )}
          <Link
            to="/scan"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-500/[0.08]"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-emerald-500">document_scanner</span>
            <span className="font-medium">Скан чека</span>
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-500/[0.08]"
            onClick={() => {
              onClearFilters()
              onClose()
            }}
          >
            <span className="material-symbols-outlined text-on-surface-variant">filter_alt_off</span>
            <span className="font-medium">Сбросить фильтры журнала</span>
          </button>
          <p className="mt-3 px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Операции
          </p>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-on-surface-variant">Ничего не найдено</p>
          ) : (
            filtered.map((tx) => (
              <button
                key={tx.id}
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left transition hover:bg-emerald-500/[0.08]"
                onClick={() => {
                  onPickTransaction(tx)
                  onClose()
                }}
              >
                <span className="font-medium text-on-surface line-clamp-1">{tx.description || '—'}</span>
                <span className="text-xs text-on-surface-variant">
                  {tx.transaction_date} · {tx.amount} BYN
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
