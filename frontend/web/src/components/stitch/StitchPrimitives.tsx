import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function StitchIcon({
  name,
  filled,
  className = '',
}: {
  name: string
  filled?: boolean
  className?: string
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden
    >
      {name}
    </span>
  )
}

export function GlassCard({
  children,
  className = '',
  hover = true,
  id,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  id?: string
}) {
  return (
    <div id={id} className={`stitch-glass-card rounded-2xl ${hover ? 'stitch-glass-card--hover' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function HeroGradient({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`stitch-hero-gradient rounded-3xl p-6 sm:p-8 ${className}`}>{children}</section>
}

export function PageHeader({
  title,
  subtitle,
  badge,
  backTo,
  backLabel,
  actions,
  className = '',
}: {
  title: string
  subtitle?: ReactNode
  badge?: ReactNode
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={`mb-section-sm flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant transition hover:text-primary"
          >
            <StitchIcon name="arrow_back" className="text-sm" />
            {backLabel ?? 'Назад'}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-headline-md text-on-surface">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 max-w-2xl text-body-base text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

type ChipVariant = 'ready' | 'pending' | 'error' | 'neutral'

const CHIP_STYLES: Record<ChipVariant, string> = {
  ready: 'bg-tertiary-fixed/20 text-tertiary',
  pending: 'bg-secondary-container text-on-secondary-container',
  error: 'bg-error-container text-error',
  neutral: 'border border-outline-variant/40 text-secondary',
}

export function StatusChip({
  variant = 'neutral',
  children,
  className = '',
}: {
  variant?: ChipVariant
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-label-caps uppercase ${CHIP_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatCard({
  icon,
  iconTint = 'primary',
  label,
  value,
  hint,
  className = '',
}: {
  icon: string
  iconTint?: 'primary' | 'tertiary' | 'error'
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  const tint =
    iconTint === 'tertiary' ? 'bg-tertiary/10 text-tertiary' : iconTint === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
  return (
    <GlassCard className={`p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
          <StitchIcon name={icon} className="text-xl" />
        </div>
        <p className="font-label text-label-caps uppercase text-secondary">{label}</p>
      </div>
      <p className="mt-3 font-headline text-headline-md text-on-surface">{value}</p>
      {hint && <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>}
    </GlassCard>
  )
}

export function FilterBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 ${className}`}>
      {children}
    </div>
  )
}

export function StitchTableShell({
  title,
  toolbar,
  children,
  className = '',
}: {
  title?: string
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <GlassCard hover={false} className={`overflow-hidden p-0 ${className}`}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
          {title && <h2 className="font-headline text-headline-sm text-on-surface">{title}</h2>}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </GlassCard>
  )
}

export function StitchTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <table className={`stitch-table w-full text-left ${className}`}>{children}</table>
}

export function BentoGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-12 gap-gutter ${className}`}>{children}</div>
}

export function AuthGlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`stitch-auth-card w-full rounded-[24px] border border-outline-variant/30 p-8 md:p-10 ${className}`}>
      {children}
    </div>
  )
}
