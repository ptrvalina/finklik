import { ACTIVE_ORG_STORAGE_KEY } from '../api/client'

/** Активная организация для ключей React Query (синхронно с API interceptor). */
export function activeOrgId(): string {
  if (typeof window === 'undefined') return '__ssr__'
  try {
    return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) || '__none__'
  } catch {
    return '__none__'
  }
}

/** Ключ запроса с привязкой к организации — снижает риск «чужих» данных при switch. */
export function orgQueryKey(base: string | readonly unknown[]): readonly unknown[] {
  const org = activeOrgId()
  if (typeof base === 'string') return [base, org] as const
  return [...base, org] as const
}
