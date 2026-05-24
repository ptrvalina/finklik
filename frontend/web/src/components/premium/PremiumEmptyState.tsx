import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Премиум-пустое состояние: спокойный градиент, подсказки и слот для действий (CTA).
 */
export function PremiumEmptyState({
  icon,
  title,
  description,
  className,
  actions,
  variant = 'default',
}: {
  icon: string
  title: string
  description?: string
  className?: string
  actions?: ReactNode
  variant?: 'default' | 'compact'
}) {
  const compact = variant === 'compact'
  return (
    <div
      className={clsx(
        'fc-calm-surface relative overflow-hidden text-center',
        compact ? 'px-5 py-10 sm:px-8' : 'px-8 py-14 sm:px-12',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent"
        aria-hidden
      />
      <span
        className={clsx(
          'material-symbols-outlined mx-auto block text-primary/38',
          compact ? 'text-[2.125rem]' : 'text-[3rem]',
        )}
      >
        {icon}
      </span>
      <p
        className={clsx(
          'font-headline font-semibold tracking-tight text-on-surface sm:font-bold',
          compact ? 'mt-3 text-base' : 'mt-4 text-lg sm:mt-5',
        )}
      >
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-snug text-on-surface-variant/90">{description}</p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:mt-6 sm:gap-3">{actions}</div>
      )}
    </div>
  )
}
