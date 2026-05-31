import { Link } from 'react-router-dom'

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

  const inner = (
    <div className={`fc-focus-strip ${toneClass}`}>
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
