import { type ReactNode, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

type AppModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Шире на планшете+ */
  wide?: boolean
  /** Очень широкая (формы с несколькими секциями) */
  extraWide?: boolean
  /** Липкая панель снизу (кнопки) — удобно на мобиле */
  footer?: ReactNode
  /** На узком экране — нижний sheet вместо полноэкранного блока */
  sheetOnMobile?: boolean
}

/**
 * Премиум-модалка: стеклянный backdrop, spring-появление, Escape, фокус на заголовке.
 */
export default function AppModal({ title, onClose, children, wide, extraWide, footer, sheetOnMobile }: AppModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  useEffect(() => {
    const root = panelRef.current
    if (!root) return
    const focusable = root.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()
  }, [])

  const widthCls = extraWide ? 'sm:max-w-3xl' : wide ? 'sm:max-w-lg' : 'sm:max-w-md'

  const panelMotion = sheetOnMobile
    ? {
        initial: { opacity: 0, y: 48 } as const,
        animate: { opacity: 1, y: 0 } as const,
        transition: { type: 'spring' as const, stiffness: 380, damping: 34 },
      }
    : {
        initial: { opacity: 0, scale: 0.97, y: 16 } as const,
        animate: { opacity: 1, scale: 1, y: 0 } as const,
        transition: { type: 'spring' as const, stiffness: 420, damping: 32 },
      }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fc-modal-backdrop fixed inset-0 z-[90] flex items-stretch justify-center sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        {...panelMotion}
        tabIndex={-1}
        className={`flex max-h-[100dvh] w-full flex-col overflow-hidden border-white/[0.08] bg-[rgb(var(--color-surface)/0.94)] shadow-[0_32px_120px_-40px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.06] backdrop-blur-2xl dark:bg-[rgb(var(--color-surface)/0.88)] sm:h-auto sm:max-h-[min(90vh,900px)] sm:rounded-3xl sm:border sm:border-outline/90 sm:shadow-lift dark:sm:border-outline/45 ${widthCls} ${
          sheetOnMobile ? 'mt-auto max-h-[min(92dvh,880px)] rounded-t-[1.75rem] border-t border-outline/80 sm:mt-0 sm:max-h-[min(90vh,900px)] sm:rounded-3xl' : 'h-[100dvh] sm:h-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-outline/80 px-4 py-4 dark:border-outline/35 sm:px-6 sm:py-5">
          <h2 id="app-modal-title" className="min-w-0 flex-1 font-headline text-base font-bold text-on-surface sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-highlight-none flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-outline/75 bg-surface-container-low text-on-surface-variant outline-none ring-emerald-400/0 transition hover:border-primary/30 hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 dark:border-outline/45 dark:text-on-surface-variant"
            aria-label="Закрыть"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-4">{children}</div>

        {footer != null && (
          <div className="flex-shrink-0 border-t border-outline/55 bg-surface-container-low/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md dark:border-outline/35 sm:rounded-b-2xl sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
