/** Плавающие быстрые действия (десктоп): не перегружает тулбар. */

type Props = {
  onIncome: () => void
  onExpense: () => void
  onFocusCapture: () => void
}

export function JournalQuickStrip({ onIncome, onExpense, onFocusCapture }: Props) {
  return (
    <div
      className="pointer-events-auto fixed bottom-24 right-4 z-[35] hidden flex-col gap-2 lg:flex"
      aria-label="Быстрые действия журнала"
    >
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-on-primary shadow-glow transition hover:bg-emerald-500"
        title="Доход"
        onClick={onIncome}
      >
        <span className="material-symbols-outlined text-2xl">south_west</span>
      </button>
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-surface/95 text-on-surface shadow-soft backdrop-blur-md transition hover:border-emerald-400/40"
        title="Расход"
        onClick={onExpense}
      >
        <span className="material-symbols-outlined text-2xl text-red-400">north_east</span>
      </button>
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-surface/95 text-primary shadow-soft backdrop-blur-md transition hover:border-primary/50"
        title="Быстрый ввод (N)"
        onClick={onFocusCapture}
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  )
}
