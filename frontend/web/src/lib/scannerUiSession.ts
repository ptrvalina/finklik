/** Org-scoped scanner UI — режим авто-перехода по очереди проверки. */
export type ScannerUiSnapshotV1 = {
  v: 1
  autoAdvanceQueue: boolean
}

function key(orgId: string) {
  return `fc_scanner_ui_v1:${orgId}`
}

export function loadScannerUiSession(orgId: string): ScannerUiSnapshotV1 | null {
  if (!orgId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key(orgId))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ScannerUiSnapshotV1>
    if (j?.v !== 1 || typeof j.autoAdvanceQueue !== 'boolean') return null
    return { v: 1, autoAdvanceQueue: j.autoAdvanceQueue }
  } catch {
    return null
  }
}

export function saveScannerUiSession(orgId: string, snap: ScannerUiSnapshotV1) {
  if (!orgId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key(orgId), JSON.stringify(snap))
  } catch {
    /* quota */
  }
}
