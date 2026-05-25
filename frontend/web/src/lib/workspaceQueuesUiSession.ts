const KEY = 'fc_workspace_queues_tab_v1'

export type WorkspaceQueuesTab = 'inbox' | 'approvals'

export function loadWorkspaceQueuesTab(): WorkspaceQueuesTab | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'inbox' || v === 'approvals' ? v : null
  } catch {
    return null
  }
}

export function saveWorkspaceQueuesTab(tab: WorkspaceQueuesTab) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, tab)
  } catch {
    /* private mode */
  }
}
