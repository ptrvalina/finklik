import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export type FocusStripProps = {
  headline: string
  supporting?: string
  ctaLabel: string
  ctaTo?: string
  onCta?: () => void
  tone?: 'primary' | 'amber' | 'neutral'
}

export function FocusStrip({
  headline,
  supporting,
  ctaLabel,
  ctaTo,
  onCta,
  tone = 'primary',
}: FocusStripProps) {
  const toneClass =
    tone === 'amber'
      ? 'fc-focus-strip--amber'
      : tone === 'neutral'
        ? 'fc-focus-strip--neutral'
        : 'fc-focus-strip--primary'

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={`fc-focus-strip ${toneClass}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Следующий шаг</p>
          <p className="mt-1 font-headline text-base font-semibold leading-snug text-on-surface">{headline}</p>
          {supporting && <p className="mt-1 text-sm text-on-surface-variant">{supporting}</p>}
        </div>
        {ctaTo ? (
          <Link
            to={ctaTo}
            className="btn-primary mt-3 min-h-10 shrink-0 px-5 text-sm shadow-[0_8px_24px_-10px_rgba(0,88,190,0.45)] transition hover:-translate-y-0.5 sm:mt-0"
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            className="btn-primary mt-3 min-h-10 shrink-0 px-5 text-sm shadow-[0_8px_24px_-10px_rgba(0,88,190,0.45)] transition hover:-translate-y-0.5 sm:mt-0"
            onClick={onCta}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </motion.div>
  )
}
