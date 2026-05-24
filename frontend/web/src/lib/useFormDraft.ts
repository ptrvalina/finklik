import { useCallback, useEffect, useRef, useState } from 'react'

type DraftOpts<T> = {
  key: string
  debounceMs?: number
  enabled?: boolean
}

/** Локальный черновик формы с debounce (sessionStorage). */
export function useFormDraft<T>(initial: T, opts: DraftOpts<T>) {
  const { key, debounceMs = 500, enabled = true } = opts
  const [value, setValue] = useState<T>(() => {
    if (!enabled || typeof window === 'undefined') return initial
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      /* ignore */
    }
    return initial
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue(next)
    },
    [],
  )

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* quota */
      }
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, key, debounceMs, enabled])

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }, [key])

  return { value, setValue: set, clearDraft }
}
