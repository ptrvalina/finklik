import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '../../api/client'
import {
  JOURNAL_CATEGORY_KEYS,
  JOURNAL_CATEGORY_LABELS,
  suggestJournalCategory,
} from '../../lib/journalCategories'
import { journalPipelineBadgeClass, journalPipelineLabel } from '../../lib/journalPipelineLabels'
import { txValidationIssues } from '../../lib/journalRowAttention'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../ui/MoneyAmount'
import { CurrencyFieldLabel } from '../ui/CurrencyFieldLabel'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

function findDuplicateTx(target: { id: string; amount?: unknown; transaction_date?: string }, items: { id: string; amount?: unknown; transaction_date?: string }[]) {
  return items.filter(
    (o) =>
      o.id !== target.id &&
      Math.abs(Number(o.amount || 0) - Number(target.amount || 0)) < 0.01 &&
      String(o.transaction_date || '') === String(target.transaction_date || ''),
  )
}

function buildTimeline(tx: {
  created_at?: string
  status?: string
  source?: string
  pipeline_status?: string | null
}) {
  const rows: { at: string; label: string }[] = []
  if (tx.created_at) {
    try {
      rows.push({
        at: new Date(tx.created_at).toLocaleString('ru-BY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        label: 'Создана в журнале',
      })
    } catch {
      rows.push({ at: '', label: 'Создана в журнале' })
    }
  }
  if (tx.source) {
    const src =
      tx.source === 'scan' ? 'Из сканера' : tx.source === 'bank' ? 'Из банка' : 'Ручной ввод'
    rows.push({ at: '', label: src })
  }
  if (tx.pipeline_status) {
    rows.push({ at: '', label: `Этап: ${journalPipelineLabel(tx.pipeline_status)}` })
  }
  rows.push({
    at: '',
    label: tx.status === 'posted' ? 'Проведена' : 'Черновик — не в отчётности',
  })
  return rows
}

function buildTxUpdateBody(
  tx: { type: string; amount: unknown; vat_amount?: unknown; transaction_date: string; source?: string },
  patch: Partial<{ amount: number; category: string; description: string }>,
) {
  return {
    type: tx.type,
    amount: patch.amount ?? Number(tx.amount),
    vat_amount: Number(tx.vat_amount ?? 0),
    category: patch.category,
    description: patch.description,
    transaction_date: tx.transaction_date,
    source: tx.source || 'manual',
  }
}

export function JournalTransactionPanel({
  tx,
  allItems,
  onClose,
  ledgerQueryKey,
  embedded,
}: {
  tx: Record<string, unknown>
  allItems: Record<string, unknown>[]
  onClose: () => void
  ledgerQueryKey: readonly unknown[]
  /** В split-панели — компактный заголовок */
  embedded?: boolean
}) {
  const qc = useQueryClient()
  const id = String(tx.id)
  const suggestion = useMemo(() => suggestJournalCategory(String(tx.description || '')), [tx.description])
  const [category, setCategory] = useState(String(tx.category || 'other'))
  const [description, setDescription] = useState(String(tx.description || ''))
  const [amount, setAmount] = useState(String(tx.amount ?? ''))
  const duplicates = useMemo(
    () => findDuplicateTx({ id, amount: tx.amount, transaction_date: String(tx.transaction_date) }, allItems as { id: string; amount?: unknown; transaction_date?: string }[]),
    [id, tx.amount, tx.transaction_date, allItems],
  )
  const issues = txValidationIssues(tx as { validation_issues?: string[] })
  const timeline = buildTimeline(tx as { created_at?: string; status?: string; source?: string; pipeline_status?: string | null })

  const aiStored = useMemo(() => {
    if (!tx.ai_analysis_json) return null
    try {
      return JSON.parse(String(tx.ai_analysis_json)) as {
        reasoning?: string
        suggested_category?: string
        confidence?: number
      }
    } catch {
      return null
    }
  }, [tx.ai_analysis_json])

  useEffect(() => {
    setCategory(String(tx.category || 'other'))
    setDescription(String(tx.description || ''))
    setAmount(String(tx.amount ?? ''))
  }, [id, tx.category, tx.description, tx.amount])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ledgerQueryKey, exact: true })
    void qc.invalidateQueries({ queryKey: ['transactions', 'recent'], exact: true })
    void qc.invalidateQueries({ queryKey: ['dashboard'], exact: true })
    void qc.invalidateQueries({ queryKey: orgQueryKey('financial-state-bundle') })
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      dashboardApi.updateTransaction(
        id,
        buildTxUpdateBody(
          tx as { type: string; amount: unknown; vat_amount?: unknown; transaction_date: string; source?: string },
          {
            amount: parseFloat(amount || '0'),
            category,
            description,
          },
        ),
      ),
    onSuccess: () => {
      refresh()
      onClose()
    },
  })

  const postMutation = useMutation({
    mutationFn: () => dashboardApi.bulkPostTransactions([id]).then((r) => r.data),
    onSuccess: () => {
      refresh()
      onClose()
    },
  })

  const aiDiffers = suggestion.category !== (tx.category || 'other')
  const isDraft = tx.status === 'draft'

  return (
    <div className={`flex h-full flex-col ${embedded ? '' : ''}`}>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-outline/35 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Операция</p>
          <p className="font-headline text-base font-bold text-on-surface inline-flex items-baseline gap-1">
            {tx.type === 'income' ? '+' : '−'}
            <MoneyAmount value={tx.amount as number | string} className="inline-flex text-inherit" />
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">{String(tx.transaction_date)}</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-container-high"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${journalPipelineBadgeClass(String(tx.pipeline_status))}`}
            >
              {journalPipelineLabel(String(tx.pipeline_status))}
            </span>
            <span className="rounded-md border border-outline/50 px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
              {isDraft ? 'Черновик' : 'Проведена'}
            </span>
          </div>

          {issues.length > 0 && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              <p className="font-bold uppercase tracking-wide">Нужно исправить</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-on-surface-variant">
              <p className="font-bold text-amber-900 dark:text-amber-200">Возможный дубликат</p>
              <p className="mt-1">Ещё {duplicates.length} с той же суммой и датой.</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Хронология</p>
            <ul className="mt-2 space-y-1.5 border-l border-outline/30 pl-3">
              {timeline.map((ev, i) => (
                <li key={i} className="text-xs text-on-surface-variant">
                  {ev.at && <span className="tabular-nums text-on-surface-variant/80">{ev.at} · </span>}
                  {ev.label}
                </li>
              ))}
            </ul>
          </div>

          {aiStored?.reasoning && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-xs">
              <p className="font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Почему так</p>
              <p className="mt-1 text-on-surface-variant">{aiStored.reasoning}</p>
            </div>
          )}

          <div>
            <label className="label">Категория</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                ИИ: {JOURNAL_CATEGORY_LABELS[suggestion.category] || suggestion.category} ({Math.round(suggestion.confidence * 100)}%)
              </span>
              {aiDiffers && (
                <button type="button" className="btn-secondary min-h-8 px-2 text-[10px]" onClick={() => setCategory(suggestion.category)}>
                  Применить
                </button>
              )}
            </div>
            <select className="input mt-2 min-h-10 w-full rounded-xl" value={category} onChange={(e) => setCategory(e.target.value)}>
              {JOURNAL_CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {JOURNAL_CATEGORY_LABELS[k] || k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label"><CurrencyFieldLabel /></label>
            <input className="input mt-1 min-h-10 w-full rounded-xl" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea className="input mt-1 min-h-[72px] w-full rounded-xl text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/scan" className="btn-secondary min-h-9 px-2 text-[10px]">
              Сканер
            </Link>
            <Link to="/bank" className="btn-secondary min-h-9 px-2 text-[10px]">
              Банк
            </Link>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex flex-col gap-2 border-t border-outline/35 p-4">
        {isDraft && issues.length === 0 && (
          <button
            type="button"
            className="btn-primary min-h-11 w-full text-sm"
            disabled={postMutation.isPending}
            onClick={() => postMutation.mutate()}
          >
            {postMutation.isPending ? 'Проводим…' : 'Провести операцию'}
          </button>
        )}
        {isDraft && issues.length > 0 && (
          <p className="text-center text-[10px] text-amber-800 dark:text-amber-200">Исправьте замечания — затем проведение.</p>
        )}
        <button
          type="button"
          className="btn-secondary min-h-10 w-full text-sm"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
        >
          {updateMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
