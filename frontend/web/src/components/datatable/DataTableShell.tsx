import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'

export type DataTableShellProps = {
  /** Липкая панель: поиск, фильтры, основные действия */
  toolbar: ReactNode
  /** Блок массовых действий (показывается если `bulkBar` передан и `selectedCount > 0`) */
  bulkBar?: ReactNode
  selectedCount?: number
  children: ReactNode
  className?: string
  /** Убрать внешнюю fc-premium-surface (если обёртка уже есть) */
  bare?: boolean
}

/**
 * Единая оболочка «тяжёлых» таблиц: липкий премиум-тулбар, анимированная bulk-панель, стеклянная поверхность.
 */
export function DataTableShell({
  toolbar,
  bulkBar,
  selectedCount = 0,
  children,
  className,
  bare,
}: DataTableShellProps) {
  const showBulk = bulkBar != null && selectedCount > 0

  return (
    <div className={clsx(!bare && 'fc-premium-surface shadow-soft', className)}>
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[rgb(var(--color-surface)/0.88)] px-3 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-[rgb(var(--color-surface)/0.72)] sm:px-4 dark:border-white/[0.06] dark:bg-[rgb(var(--color-surface)/0.65)] dark:supports-[backdrop-filter]:bg-[rgb(var(--color-surface)/0.55)]">
        {toolbar}
      </div>

      <AnimatePresence initial={false}>
        {showBulk && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="overflow-hidden border-b border-emerald-400/25 bg-gradient-to-r from-emerald-500/[0.12] via-emerald-500/[0.06] to-transparent"
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">{bulkBar}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-[12rem]">{children}</div>
    </div>
  )
}

/** Выбор строк с Escape для сброса — без привязки к домену. */
export function useDataTableSelection(idList: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => idList.includes(id))))
  }, [idList])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === idList.length && idList.every((id) => prev.has(id))) return new Set()
      return new Set(idList)
    })
  }, [idList])

  const clear = useCallback(() => setSelected(new Set()), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clear])

  return {
    selected,
    selectedCount: selected.size,
    toggle,
    toggleAllVisible,
    clear,
    isSelected: (id: string) => selected.has(id),
    allVisibleSelected: idList.length > 0 && idList.every((id) => selected.has(id)),
  }
}
