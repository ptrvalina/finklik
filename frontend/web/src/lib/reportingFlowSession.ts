/** Шаг гида отчётности и флаг проверки — отдельно на каждую организацию. */
function stepKey(orgId: string) {
  return `fc_reporting_flow_step_v1:${orgId}`
}

function validKey(orgId: string) {
  return `fc_reporting_flow_valid_v1:${orgId}`
}

export function loadReportingFlowStep(orgId: string): number {
  if (!orgId || typeof window === 'undefined') return 0
  try {
    const s = sessionStorage.getItem(stepKey(orgId))
    if (s === null) {
      const legacy = sessionStorage.getItem('fc-reporting-flow-step')
      if (legacy !== null) {
        const n = parseInt(legacy, 10)
        if (Number.isFinite(n)) return Math.min(4, Math.max(0, n))
      }
      return 0
    }
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0
  } catch {
    return 0
  }
}

export function saveReportingFlowStep(orgId: string, step: number) {
  if (!orgId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(stepKey(orgId), String(Math.min(4, Math.max(0, step))))
    sessionStorage.removeItem('fc-reporting-flow-step')
  } catch {
    /* ignore */
  }
}

export function loadReportingFlowValidated(orgId: string): boolean {
  if (!orgId || typeof window === 'undefined') return false
  try {
    const s = sessionStorage.getItem(validKey(orgId))
    if (s === null) return sessionStorage.getItem('fc-reporting-flow-validated') === '1'
    return s === '1'
  } catch {
    return false
  }
}

export function saveReportingFlowValidated(orgId: string, validated: boolean) {
  if (!orgId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(validKey(orgId), validated ? '1' : '0')
    sessionStorage.removeItem('fc-reporting-flow-validated')
  } catch {
    /* ignore */
  }
}
