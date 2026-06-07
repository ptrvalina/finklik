import { mockSignatureBase64Preview } from './signingDigest'

export type SignatureResult = {
  signature_base64: string
  certificate_pem?: string | null
  certificate_metadata?: Record<string, unknown> | null
}

/** Model A: подпись только на клиенте; сервер не вызывает sign(). */
export interface SignatureProvider {
  readonly name: string
  sign(documentHashHex: string, serverMockB64?: string | null): Promise<SignatureResult>
}

export class ClientSideProvider implements SignatureProvider {
  readonly name = 'client_side'

  async sign(documentHashHex: string, serverMockB64?: string | null): Promise<SignatureResult> {
    const signature_base64 =
      serverMockB64 && serverMockB64.trim() ? serverMockB64.trim() : mockSignatureBase64Preview(documentHashHex)
    return {
      signature_base64,
      certificate_pem: null,
      certificate_metadata: {
        placeholder: true,
        provider: this.name,
        note: 'Сертификат с модуля ЭЦП организации подставляется при интеграции; ключ не передаётся на сервер.',
      },
    }
  }
}

/** Fallback B: заглушка внешнего провайдера (без реальной интеграции). */
export class ExternalApiProvider implements SignatureProvider {
  readonly name = 'external_api_stub'

  async sign(_documentHashHex: string): Promise<SignatureResult> {
    throw new Error(
      'ExternalApiProvider не подключён. Используйте ClientSideProvider (по умолчанию) и POST /signing/complete.',
    )
  }
}

let activeProvider: SignatureProvider = new ClientSideProvider()

export function defaultSigningProvider(): SignatureProvider {
  return activeProvider
}

export function setSigningProvider(provider: SignatureProvider): void {
  activeProvider = provider
}
