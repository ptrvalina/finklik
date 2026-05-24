const KEY = 'fc-recent-clients'
const MAX = 6

export type RecentClient = { organization_id: string; organization_name: string; at: number }

export function pushRecentClient(organization_id: string, organization_name: string) {
  if (typeof window === 'undefined') return
  try {
    const prev: RecentClient[] = JSON.parse(sessionStorage.getItem(KEY) || '[]')
    const next = [
      { organization_id, organization_name, at: Date.now() },
      ...prev.filter((x) => x.organization_id !== organization_id),
    ].slice(0, MAX)
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

export function listRecentClients(): RecentClient[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]') as RecentClient[]
  } catch {
    return []
  }
}
