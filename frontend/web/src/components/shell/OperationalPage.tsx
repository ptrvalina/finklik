import type { ReactNode } from 'react'

export { FocusStrip } from './FocusStrip'
export type { FocusStripProps } from './FocusStrip'

export type OperationalPageProps = {
  eyebrow?: string
  title: string
  description?: string
  primaryAction?: ReactNode
  secondaryActions?: ReactNode
  focusStrip?: ReactNode
  children: ReactNode
  /** Узкая колонка (операции, onboarding) */
  narrow?: boolean
  className?: string
}

export default function OperationalPage({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryActions,
  focusStrip,
  children,
  narrow = false,
  className = '',
}: OperationalPageProps) {
  return (
    <div
      className={`fc-page-shell fc-page-shell-asymmetric fc-scroll-region pb-24 lg:pb-10 ${narrow ? 'mx-auto max-w-3xl' : ''} ${className}`}
    >
      <header className="fc-page-header mb-6 sm:mb-8">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        )}
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-heading">{title}</h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">{description}</p>
            )}
          </div>
          {(primaryAction || secondaryActions) && (
            <div className="page-actions shrink-0">{primaryAction}{secondaryActions}</div>
          )}
        </div>
      </header>

      {focusStrip}

      <div className="fc-section-stack">{children}</div>
    </div>
  )
}
