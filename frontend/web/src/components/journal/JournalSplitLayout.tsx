import type { ReactNode } from 'react'

/** Stitch Smart Ledger: таблица · деталь · OCR evidence. */
export function JournalSplitLayout({
  main,
  panel,
  context,
  panelOpen,
}: {
  main: ReactNode
  panel: ReactNode
  /** OCR / первичка — третья колонка */
  context?: ReactNode
  panelOpen: boolean
}) {
  if (!panelOpen) {
    return <div className="min-w-0">{main}</div>
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(360px,30vw)_min(280px,24vw)] lg:items-start lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-outline/40 lg:bg-surface lg:shadow-sm">
      <div className="min-w-0 border-outline/40 lg:border-r">{main}</div>
      <aside className="hidden min-h-0 lg:flex lg:max-h-[calc(100vh-11rem)] lg:flex-col lg:border-r lg:border-outline/40 lg:bg-surface">
        {panel}
      </aside>
      {context && (
        <aside className="hidden min-h-0 lg:flex lg:max-h-[calc(100vh-11rem)] lg:flex-col">{context}</aside>
      )}
    </div>
  )
}
