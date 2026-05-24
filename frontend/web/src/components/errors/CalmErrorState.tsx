import clsx from 'clsx'
import { extractCalmError } from '../../lib/calmError'

type Props = {
  title?: string
  error?: unknown
  fallbackMessage: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  compact?: boolean
}

/**
 * Единое спокойное состояние ошибки загрузки: без красных алертов, с явным «Повторить».
 */
export function CalmErrorState({
  title = 'Не удалось загрузить',
  error,
  fallbackMessage,
  onRetry,
  retryLabel = 'Повторить',
  className,
  compact = false,
}: Props) {
  const { message, retrySuggested } = extractCalmError(error, fallbackMessage)

  return (
    <div
      className={clsx(
        'fc-calm-error rounded-2xl border border-outline/70 bg-surface/95 text-on-surface shadow-[var(--fc-shadow-calm)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-[rgb(var(--color-surface)/0.72)]',
        compact ? 'px-4 py-3.5' : 'px-5 py-4 sm:px-6 sm:py-5',
        className,
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <span
          className="material-symbols-outlined mt-0.5 flex-shrink-0 text-[1.375rem] text-amber-600/90 dark:text-amber-400/90"
          aria-hidden
        >
          cloud_off
        </span>
        <div className="min-w-0 flex-1">
          <p className={clsx('font-headline font-semibold text-on-surface', compact ? 'text-sm' : 'text-base')}>
            {title}
          </p>
          <p className="mt-1 text-sm leading-snug text-on-surface-variant">{message}</p>
          {retrySuggested && (
            <p className="mt-2 text-xs text-on-surface-variant/90">
              Можно безопасно обновить — черновики на сервере из‑за этой ошибки не пропадают.
            </p>
          )}
          {onRetry && (
            <button type="button" className="btn-secondary fc-btn-thumb mt-3" onClick={() => onRetry()}>
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
