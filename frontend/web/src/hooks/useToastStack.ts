import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  title: string
  body?: string
  variant: ToastVariant
}

const AUTO_DISMISS_MS = 7000
const MAX_VISIBLE = 5

export function useToastStack(autoDismissMs = AUTO_DISMISS_MS) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
  }, [])

  const dismissToast = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const addToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setToasts((prev) => [{ id, ...item }, ...prev].slice(0, MAX_VISIBLE))
      const timer = setTimeout(() => dismissToast(id), autoDismissMs)
      timers.current.set(id, timer)
      return id
    },
    [autoDismissMs, dismissToast],
  )

  return { toasts, addToast, dismissToast }
}
