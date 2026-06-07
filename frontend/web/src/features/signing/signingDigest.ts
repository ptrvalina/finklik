/** Детерминированная демо-подпись по SHA-256 hex (совпадает с backend mock_signature_b64_preview). */
export function mockSignatureBase64Preview(digestHex: string): string {
  const marker = `MOCK-CMS:${digestHex}`
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(marker)
  throw new Error('btoa недоступен — подключите модуль ЭЦП организации')
}
