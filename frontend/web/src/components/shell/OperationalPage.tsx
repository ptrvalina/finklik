import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

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

export function FocusStrip({
  headline,
  supporting,
  ctaLabel,
  ctaTo,
  onCta,
  tone = 'primary',
}: {
  headline: string
  supporting?: string
  ctaLabel: string
  ctaTo?: string
  onCta?: () => void
  tone?: 'primary' | 'amber' | 'neutral'
}) {
  const border =
    tone === 'amber'
      ? 'border-amber-400/30 bg-amber-500/[0.06]'
      : tone === 'neutral'
        ? 'border-outline/40 bg-surface-container-low/50'
        : 'border-primary/30 bg-primary/[0.06]'

  const inner = (
    <div className={`rounded-2xl border px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 ${border}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Следующий шаг</p>
        <p className="mt-1 font-headline text-base font-semibold leading-snug text-on-surface">{headline}</p>
        {supporting && <p className="mt-1 text-sm text-on-surface-variant">{supporting}</p>}
      </div>
      {ctaTo ? (
        <Link to={ctaTo} className="btn-primary mt-3 min-h-10 shrink-0 px-5 text-sm sm:mt-0">
          {ctaLabel}
        </Link>
      ) : (
        <button type="button" className="btn-primary mt-3 min-h-10 shrink-0 px-5 text-sm sm:mt-0" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  )
  return <div className="mb-6">{inner}</div>
}
