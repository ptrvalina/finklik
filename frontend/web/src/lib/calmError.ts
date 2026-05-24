/** Извлекает спокойное сообщение из ошибки API (axios interceptor в client.ts). */
export function extractCalmError(
  error: unknown,
  fallback: string,
): { message: string; retrySuggested: boolean } {
  const e = error as { calmUserMessage?: string; retrySuggested?: boolean } | undefined
  const message = e?.calmUserMessage?.trim() || fallback
  return { message, retrySuggested: Boolean(e?.retrySuggested) }
}
