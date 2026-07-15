import { StitchIcon } from '../stitch'

export default function ScannerExecutionHint({
  message,
  category,
  debit,
  credit,
  warnings,
}: {
  message?: string | null
  category?: string | null
  debit?: string | null
  credit?: string | null
  warnings?: string[]
}) {
  const hasHints = message || category || debit || credit
  const warnList = (warnings || []).filter(Boolean)
  if (!hasHints && warnList.length === 0) return null

  return (
    <div className="space-y-2">
      {message && (
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm text-on-surface">
          <div className="flex gap-2">
            <StitchIcon name="auto_awesome" className="mt-0.5 shrink-0 text-primary" />
            <p>{message}</p>
          </div>
        </div>
      )}
      {(category || debit || credit) && (
        <div className="rounded-xl border border-outline/30 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          {category && (
            <p>
              Категория: <span className="font-semibold text-on-surface">{category}</span>
            </p>
          )}
          {(debit || credit) && (
            <p className={category ? 'mt-1' : ''}>
              Проводка: Дт <span className="font-mono font-semibold text-on-surface">{debit || '—'}</span>
              {' · '}
              Кт <span className="font-mono font-semibold text-on-surface">{credit || '—'}</span>
            </p>
          )}
        </div>
      )}
      {warnList.length > 0 && (
        <ul className="rounded-xl border border-amber-400/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {warnList.map((w) => (
            <li key={w} className="flex gap-1.5">
              <StitchIcon name="info" className="shrink-0 text-sm" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
