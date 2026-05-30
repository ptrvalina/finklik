/** Stitch Smart Ledger — колонка OCR / первичка справа от детали операции. */
export function JournalEvidencePanel({
  tx,
  onClose,
}: {
  tx: Record<string, unknown>
  onClose?: () => void
}) {
  const receiptUrl = tx.receipt_image_url ? String(tx.receipt_image_url) : ''
  const source = String(tx.source || 'manual')
  const confidence = tx.ai_category_confidence != null ? Number(tx.ai_category_confidence) : null
  const verified = source === 'scan' || Boolean(receiptUrl)

  return (
    <div className="flex h-full flex-col bg-surface-container-low/40">
      <div className="flex shrink-0 items-center justify-between border-b border-outline/35 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">OCR Evidence</p>
          <p className="text-xs font-semibold text-on-surface">
            {verified ? 'Verified match' : 'Без первички'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-container-high lg:hidden"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {receiptUrl ? (
          <div className="overflow-hidden rounded-xl border border-outline/40 bg-surface shadow-sm">
            <img src={receiptUrl} alt="Первичный документ" className="max-h-64 w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-outline/50 bg-surface/80">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">receipt_long</span>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="glass-card rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Источник</p>
            <p className="mt-1 text-sm font-semibold text-on-surface">
              {source === 'scan' ? 'Сканер / OCR' : source === 'bank' ? 'Банковская выписка' : 'Ручной ввод'}
            </p>
          </div>

          {confidence != null && Number.isFinite(confidence) && (
            <div className="glass-card rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Уверенность ИИ</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.round(confidence * 100))}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-primary">{Math.round(confidence * 100)}%</span>
              </div>
            </div>
          )}

          <div className="glass-card rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Категоризация</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Проверьте счёт и проект в центральной панели — затем проведите операцию.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
