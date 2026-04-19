import type { ToastItem, ToastVariant } from '../../hooks/useToastStack'

function variantClasses(v: ToastVariant): string {
  switch (v) {
    case 'success':
      return 'border-emerald-200/90 bg-emerald-50/95 text-emerald-950 shadow-[0_12px_40px_-12px_rgb(16_185_129/0.35)] dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-50'
    case 'error':
      return 'border-red-200/90 bg-red-50/95 text-red-950 shadow-[0_12px_40px_-12px_rgb(239_68_68/0.3)] dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-50'
    default:
      return 'border-outline/80 bg-surface/98 text-on-surface shadow-lift dark:border-zinc-700/80 dark:bg-zinc-900/98'
  }
}

export default function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex max-w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm backdrop-blur-md transition-opacity duration-200 ${variantClasses(t.variant)}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-headline font-semibold leading-tight">{t.title}</p>
              {t.body && (
                <p className="mt-1 whitespace-pre-line text-[13px] leading-snug opacity-90">{t.body}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="tap-highlight-none flex-shrink-0 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Закрыть уведомление"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
