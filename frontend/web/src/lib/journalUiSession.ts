/**
 * Org-scoped journal UI snapshot — filters and workspace focus survive navigation
 * (e.g. OCR / scan → back to журнал) without URL hacks.
 */
export type JournalUiSnapshotV1 = {
  v: 1
  filterDateFrom: string
  filterDateTo: string
  filterType: 'all' | 'income' | 'expense'
  filterSearch: string
  attentionFilter: 'all' | 'drafts' | 'issues'
  workspaceFocus: 'ledger' | 'capture'
  /** Открытая строка в split-панели (восстанавливается при возврате в журнал). */
  panelTxId?: string | null
}

function key(orgId: string) {
  return `fc_journal_ui_v1:${orgId}`
}

export function loadJournalUiSession(orgId: string): JournalUiSnapshotV1 | null {
  if (!orgId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key(orgId))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<JournalUiSnapshotV1>
    if (j?.v !== 1) return null
    if (
      typeof j.filterDateFrom !== 'string' ||
      typeof j.filterDateTo !== 'string' ||
      !['all', 'income', 'expense'].includes(String(j.filterType)) ||
      typeof j.filterSearch !== 'string' ||
      !['all', 'drafts', 'issues'].includes(String(j.attentionFilter)) ||
      !['ledger', 'capture'].includes(String(j.workspaceFocus))
    ) {
      return null
    }
    const panelTxId = j.panelTxId === null || typeof j.panelTxId === 'string' ? j.panelTxId : undefined
    return {
      v: 1,
      filterDateFrom: j.filterDateFrom,
      filterDateTo: j.filterDateTo,
      filterType: j.filterType as JournalUiSnapshotV1['filterType'],
      filterSearch: j.filterSearch,
      attentionFilter: j.attentionFilter as JournalUiSnapshotV1['attentionFilter'],
      workspaceFocus: j.workspaceFocus as JournalUiSnapshotV1['workspaceFocus'],
      panelTxId,
    }
  } catch {
    return null
  }
}

export function saveJournalUiSession(orgId: string, snap: JournalUiSnapshotV1) {
  if (!orgId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key(orgId), JSON.stringify(snap))
  } catch {
    /* quota / private mode */
  }
}
