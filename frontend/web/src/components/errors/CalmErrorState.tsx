import clsx from 'clsx'
import { extractCalmError } from '../../lib/calmError'
import { GlassCard, StatusChip, StitchIcon } from '../stitch'

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
    <div role="alert" className={className}>
      <GlassCard
        hover={false}
        className={clsx(
          'relative overflow-hidden border-outline-variant/40',
          compact ? 'p-4' : 'p-5 sm:p-6',
        )}
      >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" aria-hidden />
      <div className={clsx('relative flex gap-4', compact ? 'items-start' : 'flex-col items-center text-center sm:flex-row sm:text-left')}>
        <div
          className={clsx(
            'flex shrink-0 items-center justify-center rounded-2xl bg-secondary-container text-secondary',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <StitchIcon name="cloud_off" className={compact ? 'text-xl' : 'text-2xl'} />
        </div>
        <div className="min-w-0 flex-1">
          <StatusChip variant="neutral" className="mb-2 normal-case tracking-normal">
            Ошибка загрузки
          </StatusChip>
          <p className={clsx('font-headline font-semibold text-on-surface', compact ? 'text-sm' : 'text-headline-sm')}>
            {title}
          </p>
          <p className="mt-1 text-sm leading-snug text-on-surface-variant">{message}</p>
          {retrySuggested && (
            <p className="mt-2 text-xs text-on-surface-variant/90">
              Можно безопасно обновить — черновики на сервере из‑за этой ошибки не пропадают.
            </p>
          )}
          {onRetry && (
            <button
              type="button"
              className={clsx('btn-primary mt-4 inline-flex min-h-touch-min items-center gap-2', compact ? 'text-sm' : '')}
              onClick={() => onRetry()}
            >
              <StitchIcon name="refresh" className="text-base" />
              {retryLabel}
            </button>
          )}
        </div>
      </div>
      </GlassCard>
    </div>
  )
}
