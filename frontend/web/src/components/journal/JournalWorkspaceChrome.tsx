import { Link } from 'react-router-dom'

export type JournalStats = {
  count: number
  income: number
  expense: number
  drafts: number
  issues: number
}

function fmt(n: number) {
  return n.toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Props = {
  workspaceFocus: 'ledger' | 'capture'
  onWorkspaceFocus: (f: 'ledger' | 'capture') => void
  stats: JournalStats
  onFilterDrafts: () => void
  onFilterIssues: () => void
}

/** Компактная шапка журнала: режим журнал/ввод, метрики, быстрые ссылки — без дублирующих баннеров. */
export function JournalWorkspaceChrome({
  workspaceFocus,
  onWorkspaceFocus,
  stats,
  onFilterDrafts,
  onFilterIssues,
}: Props) {
  return (
    <div className="rounded-2xl border border-outline/35 bg-surface/90 p-4 sm:p-5">
      <div className="mb-4">
        <h1 className="page-heading">Журнал</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Операции и категории — основа для отчётов.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-outline/40 bg-surface-container-low/60 p-0.5">
          {(
            [
              { id: 'ledger' as const, label: 'Журнал', icon: 'receipt_long' },
              { id: 'capture' as const, label: 'Ввод', icon: 'edit_note' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onWorkspaceFocus(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                workspaceFocus === t.id ? 'bg-primary text-primary-on' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <Link to="/accounting/kudir" className="rounded-lg border border-outline/35 px-2 py-1 font-semibold text-on-surface-variant hover:text-primary">
            КУДиР
          </Link>
          <Link to="/reports" className="rounded-lg border border-outline/35 px-2 py-1 font-semibold text-on-surface-variant hover:text-primary">
            Отчёты
          </Link>
          <Link to="/calendar" className="rounded-lg border border-outline/35 px-2 py-1 font-semibold text-on-surface-variant hover:text-primary">
            Календарь
          </Link>
          <Link to="/bank" className="rounded-lg border border-outline/35 px-2 py-1 font-semibold text-on-surface-variant hover:text-primary">
            Банк
          </Link>
          <Link to="/scan" className="rounded-lg border border-outline/35 px-2 py-1 font-semibold text-on-surface-variant hover:text-primary">
            Сканер
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-outline/25 pt-4 text-sm tabular-nums">
        <span>
          <span className="text-on-surface-variant">В фильтре </span>
          <strong className="text-on-surface">{stats.count}</strong>
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">+{fmt(stats.income)}</span>
        <span className="text-on-surface">−{fmt(stats.expense)}</span>
        {stats.drafts > 0 && (
          <button type="button" className="font-semibold text-amber-600 dark:text-amber-400" onClick={onFilterDrafts}>
            {stats.drafts} черновиков
          </button>
        )}
        {stats.issues > 0 && (
          <button type="button" className="font-semibold text-amber-700 dark:text-amber-300" onClick={onFilterIssues}>
            {stats.issues} с замечаниями
          </button>
        )}
        {stats.drafts === 0 && stats.issues === 0 && stats.count > 0 && (
          <span className="text-xs text-emerald-700 dark:text-emerald-300">Готово к отчётности по фильтру</span>
        )}
      </div>
    </div>
  )
}
