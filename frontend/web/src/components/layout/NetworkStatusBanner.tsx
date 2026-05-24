import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'

/**
 * Тонкий баннер при потере сети; при восстановлении — мягкая инвалидация кэша.
 */
export default function NetworkStatusBanner() {
  const { online } = useNetworkStatus()
  const queryClient = useQueryClient()
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (!online) {
      setWasOffline(true)
      setShowReconnected(false)
      return
    }
    if (wasOffline) {
      setShowReconnected(true)
      void queryClient.invalidateQueries()
      const t = window.setTimeout(() => setShowReconnected(false), 4000)
      return () => window.clearTimeout(t)
    }
  }, [online, wasOffline, queryClient])

  if (online && !showReconnected) return null

  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        online
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
          : 'border-amber-400/25 bg-amber-500/[0.08] text-on-surface'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="material-symbols-outlined text-[1.25rem]" aria-hidden>
        {online ? 'wifi' : 'wifi_off'}
      </span>
      <span className="leading-snug">
        {online ? 'Соединение восстановлено — обновляем данные…' : 'Нет сети. Черновики на устройстве сохранены; повторите, когда появится интернет.'}
      </span>
    </div>
  )
}
