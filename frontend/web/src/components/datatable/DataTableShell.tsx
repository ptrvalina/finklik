import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
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
function DataTableShellInner({
  toolbar,
  bulkBar,
  selectedCount = 0,
  children,
  className,
  bare,
}: DataTableShellProps) {
  const showBulk = bulkBar != null && selectedCount > 0

  return (
    <div
      className={clsx(
        !bare && 'fc-premium-surface shadow-soft',
        showBulk && 'fc-datatable-shell--bulk',
        className,
      )}
    >
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[rgb(var(--color-surface)/0.88)] px-3 py-[var(--fc-toolbar-y)] backdrop-blur-[var(--fc-blur-glass)] supports-[backdrop-filter]:bg-[rgb(var(--color-surface)/0.72)] sm:px-4 sm:py-[var(--fc-toolbar-y-sm)] dark:border-white/[0.06] dark:bg-[rgb(var(--color-surface)/0.65)] dark:supports-[backdrop-filter]:bg-[rgb(var(--color-surface)/0.55)]">
        {toolbar}
      </div>

      <AnimatePresence initial={false}>
        {showBulk && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 36, mass: 0.85 }}
            className="overflow-hidden border-b border-outline/30 bg-surface-container-low/50 dark:border-white/[0.06] dark:bg-white/[0.04] max-lg:fixed max-lg:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] max-lg:left-3 max-lg:right-3 max-lg:z-40 max-lg:rounded-2xl max-lg:border max-lg:border-outline/50 max-lg:shadow-float max-lg:backdrop-blur-xl lg:static lg:rounded-none lg:shadow-none"
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-[var(--fc-toolbar-y)] sm:px-4 sm:py-[var(--fc-toolbar-y-sm)] max-lg:max-h-[40vh] max-lg:overflow-y-auto">
              {bulkBar}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-[12rem]">{children}</div>
    </div>
  )
}

export const DataTableShell = memo(DataTableShellInner)

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

  const selectedCount = selected.size
  const allVisibleSelected = idList.length > 0 && idList.every((id) => selected.has(id))
  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  return useMemo(
    () => ({
      selected,
      selectedCount,
      toggle,
      toggleAllVisible,
      clear,
      isSelected,
      allVisibleSelected,
    }),
    [selected, selectedCount, toggle, toggleAllVisible, clear, isSelected, allVisibleSelected],
  )
}
