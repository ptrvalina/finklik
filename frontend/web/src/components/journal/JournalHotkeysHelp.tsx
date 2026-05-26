const ROWS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+K', action: 'Командная палитра' },
  { keys: 'N', action: 'Новая операция (ввод)' },
  { keys: 'I', action: 'Быстрый доход' },
  { keys: 'E', action: 'Быстрый расход' },
  { keys: '/', action: 'Поиск в журнале' },
  { keys: 'G', action: 'Вкладка «Журнал»' },
  { keys: 'D', action: 'Только черновики' },
  { keys: 'P', action: 'Провести выбранный черновик' },
  { keys: '↑ ↓ Enter', action: 'Строка журнала' },
  { keys: 'Esc', action: 'Закрыть панель / палитру' },
  { keys: '?', action: 'Эта подсказка' },
]

type Props = {
  onClose: () => void
}

export function JournalHotkeysHelp({ onClose }: Props) {
  return (
    <div
      className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5"
      role="region"
      aria-label="Горячие клавиши журнала"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-on-surface">Горячие клавиши</p>
        <button
          type="button"
          className="btn-ghost !min-h-8 !px-2 !py-1 text-xs"
          onClick={onClose}
          aria-label="Скрыть подсказку"
        >
          Скрыть
        </button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ROWS.map((r) => (
          <li key={r.keys} className="flex items-center gap-2 text-sm">
            <kbd className="rounded-md border border-outline/60 bg-surface px-1.5 py-0.5 font-mono text-[11px] text-on-surface">
              {r.keys}
            </kbd>
            <span className="text-on-surface-variant">{r.action}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
