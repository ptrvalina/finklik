import { resolveAppPath } from '../appBase'

/** Полная ссылка для ручной отправки invite (runbook без EMAIL_API_KEY). */
export function buildInviteAcceptUrl(inviteCode: string): string {
  const code = encodeURIComponent(inviteCode.trim())
  const path = resolveAppPath(`/accept-invite?code=${code}`)
  if (typeof window === 'undefined') return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${window.location.origin}${path}`
}

export async function copyInviteAcceptUrl(inviteCode: string): Promise<boolean> {
  const url = buildInviteAcceptUrl(inviteCode)
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}
