import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

/** Короткий «вау» после подтверждения скана → журнал. */
export default function ScannerSuccessBurst({
  amountLabel,
  counterparty,
  journalTo,
  onScanAnother,
}: {
  amountLabel?: string
  counterparty?: string
  journalTo: string
  onScanAnother: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="fc-success-burst relative overflow-hidden rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-500/15 via-surface to-primary/10 p-5 sm:p-6"
    >
      <div className="fc-success-burst-glow" aria-hidden />
      <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-200">
              <span className="material-symbols-outlined text-2xl">task_alt</span>
            </span>
            <div>
              <p className="font-headline text-base font-bold text-on-surface sm:text-lg">В учёте</p>
              <p className="text-xs text-on-surface-variant">
                {counterparty ? `${counterparty} · ` : ''}
                {amountLabel || 'Операция создана'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to={journalTo} className="btn-primary min-h-11 justify-center text-sm">
            Открыть в журнале
          </Link>
          <button type="button" className="btn-secondary min-h-11 text-sm" onClick={onScanAnother}>
            Ещё документ
          </button>
        </div>
      </div>
    </motion.div>
  )
}
