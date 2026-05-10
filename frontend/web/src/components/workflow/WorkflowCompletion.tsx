import { motion } from 'framer-motion'

/** Баннер успеха для AnimatePresence (родитель монтирует/снимает) */
export function WorkflowCompletionBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 px-4 py-3 shadow-soft backdrop-blur-md"
      role="status"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
        <span className="material-symbols-outlined text-2xl">check_circle</span>
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold text-on-surface">{message}</p>
      {onDismiss && (
        <button type="button" className="btn-ghost min-h-9 px-2 text-xs" onClick={onDismiss}>
          OK
        </button>
      )}
    </motion.div>
  )
}
