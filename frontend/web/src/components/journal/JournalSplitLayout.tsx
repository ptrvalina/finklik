import type { ReactNode } from 'react'

/** Desktop split: таблица слева, деталь операции справа без модального оверлея. */
export function JournalSplitLayout({
  main,
  panel,
  panelOpen,
}: {
  main: ReactNode
  panel: ReactNode
  panelOpen: boolean
}) {
  return (
    <div
      className={
        panelOpen
          ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_min(400px,36vw)] lg:items-start lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-outline/35'
          : ''
      }
    >
      <div className="min-w-0">{main}</div>
      {panelOpen && (
        <aside className="hidden min-h-0 lg:flex lg:max-h-[calc(100vh-12rem)] lg:flex-col lg:border-l lg:border-outline/35 lg:bg-surface/95">
          {panel}
        </aside>
      )}
    </div>
  )
}
