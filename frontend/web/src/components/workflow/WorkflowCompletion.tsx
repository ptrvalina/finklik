import { motion } from 'framer-motion'
import { GlassCard, StatusChip, StitchIcon } from '../stitch'

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
      role="status"
    >
      <GlassCard
        hover={false}
        className="flex items-center gap-4 border-tertiary-fixed/30 p-4 shadow-[0_0_40px_-10px_rgba(103,220,168,0.35)] sm:p-5"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed">
          <StitchIcon name="check_circle" filled className="text-2xl text-tertiary" />
        </div>
        <div className="min-w-0 flex-1">
          <StatusChip variant="ready" className="mb-1.5">
            Готово
          </StatusChip>
          <p className="text-sm font-semibold leading-snug text-on-surface">{message}</p>
        </div>
        {onDismiss && (
          <button type="button" className="btn-secondary shrink-0 rounded-full px-4 text-xs" onClick={onDismiss}>
            OK
          </button>
        )}
      </GlassCard>
    </motion.div>
  )
}
