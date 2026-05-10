import type { ReactNode } from 'react'
import clsx from 'clsx'
import { motion, type HTMLMotionProps } from 'framer-motion'

type GlassCardProps = HTMLMotionProps<'div'> & {
  children: ReactNode
  hoverLift?: boolean
  /** Stronger glass edge for nested panels */
  variant?: 'default' | 'subtle'
}

/**
 * FinClick Premium — floating glass surface (24px radius, blur, layered shadow).
 */
export function GlassCard({ className, children, hoverLift = true, variant = 'default', ...rest }: GlassCardProps) {
  return (
    <motion.div
      whileHover={
        hoverLift
          ? { y: -5, transition: { type: 'spring', stiffness: 420, damping: 28 } }
          : undefined
      }
      className={clsx(
        'relative overflow-hidden rounded-3xl border backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-[1] before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent dark:before:via-emerald-300/25',
        variant === 'default'
          ? 'border-white/[0.14] bg-gradient-to-br from-white/[0.88] via-white/72 to-surface/92 shadow-[0_16px_56px_-20px_rgba(0,77,64,0.22),0_4px_28px_-8px_rgba(16,185,129,0.1),inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-emerald-500/[0.08] dark:border-white/[0.1] dark:from-white/[0.11] dark:via-white/[0.05] dark:to-[rgb(var(--color-surface)/0.68)] dark:shadow-[0_36px_120px_-48px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-emerald-400/[0.12]'
          : 'border-outline/50 bg-surface/75 shadow-card ring-1 ring-white/5 dark:border-white/[0.06] dark:bg-[rgb(var(--color-surface)/0.48)]',
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
