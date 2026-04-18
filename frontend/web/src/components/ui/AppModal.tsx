import type { ReactNode } from 'react'

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
}

/**
 * Модалка: на мобиле — почти на весь экран с safe-area;
 * с sm — классическое окно по центру.
 */
export default function AppModal({ title, onClose, children, wide, extraWide, footer }: AppModalProps) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-[#12161f] shadow-2xl sm:h-auto sm:max-h-[min(90vh,900px)] sm:rounded-2xl sm:ring-1 sm:ring-white/[0.08] ${
          extraWide ? 'sm:max-w-3xl' : wide ? 'sm:max-w-lg' : 'sm:max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6 sm:py-4">
          <h2 id="app-modal-title" className="min-w-0 flex-1 font-headline text-base font-bold text-white sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-highlight-none flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1] hover:text-white"
            aria-label="Закрыть"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-4">{children}</div>

        {footer != null && (
          <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#12161f] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:rounded-b-2xl sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
