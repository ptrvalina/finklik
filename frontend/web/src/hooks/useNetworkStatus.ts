import { useEffect, useState } from 'react'

/** Онлайн-статус браузера; при SSR/тестах считаем онлайн. */
export function useNetworkStatus(): { online: boolean } {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return { online }
}
