import { type ReactNode, useEffect } from 'react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Контекстная правая панель: остаёмся в потоке учёта / банка / сверки без полной смены страницы.
 */
export function WorkflowSidePanel({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClassName,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Tailwind max-width для панели (например max-w-md) */
  widthClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Закрыть панель"
            className="fc-modal-backdrop fixed inset-0 z-[85]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-panel-title"
            className={clsx(
              'fixed inset-y-0 right-0 z-[86] flex w-full flex-col border-l border-white/[0.08] bg-[rgb(var(--color-surface)/0.96)] shadow-[0_0_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl dark:bg-[rgb(var(--color-surface)/0.92)]',
              widthClassName || 'max-w-[min(100vw,440px)]',
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-outline/60 px-4 py-4 dark:border-outline/30 sm:px-5 sm:py-5">
              <div className="min-w-0">
                <h2 id="workflow-panel-title" className="font-headline text-lg font-bold text-on-surface">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>}
              </div>
              <button
                type="button"
                className="tap-highlight-none flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-outline/60 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                onClick={onClose}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
            {footer && <div className="flex-shrink-0 border-t border-outline/50 px-4 py-3 dark:border-outline/25 sm:px-5">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
