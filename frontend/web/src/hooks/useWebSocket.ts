import { useEffect, useRef, useState, useCallback } from 'react'
import { resolveApiBase } from '../api/client'

export interface WsNotification {
  id: string
  event: string
  data: any
  timestamp: number
}

const RECONNECT_DELAY = 3000

function wsUrlFromApiBase(apiBase: string): string {
  return apiBase.replace(/^http/, 'ws') + '/ws'
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<WsNotification[]>([])

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      const ws = new WebSocket(`${wsUrlFromApiBase(resolveApiBase())}?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'pong') return
          if (msg.event === 'connected') return

          setNotifications((prev) => [
            { id: `${Date.now()}-${Math.random()}`, event: msg.event, data: msg.data, timestamp: Date.now() },
            ...prev.slice(0, 49),
          ])
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = () => ws.close()
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return { connected, notifications, dismissNotification }
}
