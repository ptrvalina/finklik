import { useMemo } from 'react'
import type { OcrFieldKey } from '../../lib/ocrCorrectionFields'

export type FieldRegion = { left: number; top: number; width: number; height: number }

const FIELD_REGION_KEY: Partial<Record<OcrFieldKey, string>> = {
  counterparty: 'counterparty_name',
  transactionDate: 'transaction_date',
  amount: 'amount',
  vatAmount: 'vat_amount',
  description: 'description',
}

export default function OcrPreviewOverlay({
  previewUrl,
  fieldRegions,
  activeField,
  onFieldClick,
}: {
  previewUrl: string
  fieldRegions?: Record<string, FieldRegion>
  activeField?: OcrFieldKey | null
  onFieldClick?: (field: OcrFieldKey) => void
}) {
  const activeRegionKey = activeField ? FIELD_REGION_KEY[activeField] : null
  const highlights = useMemo(() => {
    if (!fieldRegions) return []
    return Object.entries(fieldRegions).map(([key, box]) => ({
      key,
      box,
      active: key === activeRegionKey,
    }))
  }, [fieldRegions, activeRegionKey])

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-surface">
      <img src={previewUrl} alt="Документ" className="w-full rounded-lg object-contain max-h-[min(520px,60vh)] bg-surface" />
      {highlights.map(({ key, box, active }) => (
        <button
          key={key}
          type="button"
          className={`absolute rounded border-2 transition ${
            active
              ? 'border-primary bg-primary/20 ring-2 ring-primary/40'
              : 'border-amber-400/70 bg-amber-400/15 hover:border-primary hover:bg-primary/15'
          }`}
          style={{
            left: `${box.left * 100}%`,
            top: `${box.top * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
          aria-label={`Поле ${key}`}
          onClick={() => {
            const fk = (Object.entries(FIELD_REGION_KEY).find(([, v]) => v === key)?.[0] || null) as OcrFieldKey | null
            if (fk && onFieldClick) onFieldClick(fk)
          }}
        />
      ))}
    </div>
  )
}
