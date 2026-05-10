import type { ReactNode } from 'react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { GlassCard } from '../premium/GlassCard'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

type Tone = 'insight' | 'warning' | 'recommend'

const toneRing: Record<Tone, string> = {
  insight: 'ring-emerald-400/25',
  warning: 'ring-amber-400/35',
  recommend: 'ring-cyan-400/25',
}

const toneBadge: Record<Tone, string> = {
  insight: 'bg-emerald-500/15 text-emerald-200',
  warning: 'bg-amber-500/15 text-amber-100',
  recommend: 'bg-cyan-500/15 text-cyan-100',
}

export function InsightCard({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <GlassCard className={clsx('p-5', toneRing.insight, className)} hoverLift>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl', toneBadge.insight)}>
            <Icon name="lightbulb" className="text-xl" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/90">Инсайт</p>
            <h3 className="mt-1 font-headline text-base font-bold text-on-surface">{title}</h3>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-3 text-sm leading-relaxed text-on-surface-variant">{children}</div>
    </GlassCard>
  )
}

export function WarningCard({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <GlassCard className={clsx('border-amber-400/20 p-5', toneRing.warning, className)} hoverLift={false}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl', toneBadge.warning)}>
              <Icon name="warning" className="text-xl text-amber-200" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">Внимание</p>
              <h3 className="mt-1 font-headline text-base font-bold text-on-surface">{title}</h3>
            </div>
          </div>
          {action}
        </div>
        <div className="mt-3 text-sm leading-relaxed text-on-surface-variant">{children}</div>
      </GlassCard>
    </motion.div>
  )
}

export function RecommendationCard({
  title,
  children,
  cta,
  className,
}: {
  title: string
  children: ReactNode
  cta?: ReactNode
  className?: string
}) {
  return (
    <GlassCard className={clsx('p-5', toneRing.recommend, className)} hoverLift>
      <div className="flex gap-3">
        <span className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl', toneBadge.recommend)}>
          <Icon name="auto_awesome" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/85">Рекомендация</p>
          <h3 className="mt-1 font-headline text-base font-bold text-on-surface">{title}</h3>
          <div className="mt-2 text-sm leading-relaxed text-on-surface-variant">{children}</div>
          {cta && <div className="mt-4">{cta}</div>}
        </div>
      </div>
    </GlassCard>
  )
}

export function SmartSummaryPanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-transparent p-5 backdrop-blur-xl dark:border-white/[0.08]',
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-on-surface-variant/90">{subtitle}</p>}
      <div className="mt-4 space-y-3 text-sm text-on-surface">{children}</div>
    </div>
  )
}

const urgencyStyles = {
  critical: {
    ring: 'ring-red-400/40',
    badge: 'bg-red-500/20 text-red-100',
    bar: 'bg-gradient-to-r from-red-500 to-orange-500',
    label: 'Критично',
  },
  high: {
    ring: 'ring-amber-400/35',
    badge: 'bg-amber-500/20 text-amber-100',
    bar: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    label: 'Срочно',
  },
  standard: {
    ring: 'ring-emerald-400/25',
    badge: 'bg-emerald-500/15 text-emerald-100',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    label: 'В очереди',
  },
} as const

export type TaskUrgency = keyof typeof urgencyStyles

/** Задача командного центра: срочность, влияние, одно действие */
export function PriorityTaskCard({
  urgency,
  title,
  impact,
  children,
  action,
  className,
}: {
  urgency: TaskUrgency
  title: string
  impact?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const u = urgencyStyles[urgency]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
    >
      <GlassCard className={clsx('overflow-hidden p-0', u.ring, className)} hoverLift={urgency !== 'critical'}>
        <div className={clsx('h-1 w-full', u.bar)} aria-hidden />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 gap-3">
              <span className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-[10px] font-bold uppercase tracking-wider', u.badge)}>
                <Icon name={urgency === 'critical' ? 'priority_high' : urgency === 'high' ? 'bolt' : 'schedule'} className="text-xl" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{u.label}</p>
                <h3 className="mt-1 font-headline text-base font-bold leading-snug text-on-surface">{title}</h3>
                {impact && <p className="mt-1 text-xs font-medium text-on-surface-variant">{impact}</p>}
              </div>
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
          {children && <div className="mt-3 text-sm leading-relaxed text-on-surface-variant">{children}</div>}
        </div>
      </GlassCard>
    </motion.div>
  )
}
