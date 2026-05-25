import type { OperationalVerb } from './operationalVerbs'

export type OperationalNextStep = {
  verb: OperationalVerb
  label: string
  path: string
  at: number
}

export type OperationalSessionV1 = {
  v: 1
  lastOcrDoc?: { id: string; title: string; at: number }
  lastTransaction?: { id: string; title: string; at: number }
  activeWorkPack?: { id: string; title: string; at: number }
  lastReportingBlocker?: { label: string; path: string; at: number }
  nextStep?: OperationalNextStep
}

function storageKey(orgId: string) {
  return `fc_operational_session_v1:${orgId}`
}

export function loadOperationalSession(orgId: string): OperationalSessionV1 | null {
  if (!orgId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(orgId))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<OperationalSessionV1>
    if (j?.v !== 1) return null
    return { v: 1, ...j }
  } catch {
    return null
  }
}

export function saveOperationalSession(orgId: string, session: OperationalSessionV1) {
  if (!orgId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(orgId), JSON.stringify(session))
  } catch {
    /* quota */
  }
}

export function hasOperationalAnchors(session: OperationalSessionV1 | null): boolean {
  if (!session) return false
  return Boolean(
    session.lastOcrDoc ||
      session.lastTransaction ||
      session.activeWorkPack ||
      session.lastReportingBlocker ||
      session.nextStep,
  )
}
