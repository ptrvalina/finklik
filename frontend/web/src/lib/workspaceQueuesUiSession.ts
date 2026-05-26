const LEGACY_KEY = 'fc_workspace_queues_tab_v1'

function key(userId: string) {
  return `fc_workspace_queues_tab_v2:${userId}`
}

export type WorkspaceQueuesTab = 'inbox' | 'approvals'

export function loadWorkspaceQueuesTab(userId: string): WorkspaceQueuesTab | null {
  if (!userId || typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(key(userId))
    if (v === 'inbox' || v === 'approvals') return v
    const legacy = sessionStorage.getItem(LEGACY_KEY)
    if (legacy === 'inbox' || legacy === 'approvals') return legacy
    return null
  } catch {
    return null
  }
}

export function saveWorkspaceQueuesTab(userId: string, tab: WorkspaceQueuesTab) {
  if (!userId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key(userId), tab)
    sessionStorage.removeItem(LEGACY_KEY)
  } catch {
    /* private mode */
  }
}
