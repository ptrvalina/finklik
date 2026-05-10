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
        'relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-transparent to-emerald-500/[0.05] text-center backdrop-blur-xl',
        'dark:border-white/[0.08]',
        compact ? 'px-5 py-10 sm:px-8' : 'px-8 py-14 sm:px-12',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent"
        aria-hidden
      />
      <span
        className={clsx(
          'material-symbols-outlined mx-auto block text-primary/45',
          compact ? 'text-4xl' : 'text-[3.25rem]',
        )}
      >
        {icon}
      </span>
      <p className={clsx('font-headline font-bold text-on-surface', compact ? 'mt-3 text-base' : 'mt-5 text-lg')}>{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">{description}</p>
      )}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  )
}
