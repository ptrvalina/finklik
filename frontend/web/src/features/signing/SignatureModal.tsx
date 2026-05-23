import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import AppModal from '../../components/ui/AppModal'
import { signingApi, type SigningDocumentKind, type SigningRequestResponse } from '../../api/client'
import { formatApiDetail } from '../../utils/apiError'

function localClientSignBase64(documentHashHex: string, serverMockB64: string | null | undefined): string {
  if (serverMockB64 && serverMockB64.trim()) return serverMockB64.trim()
  const marker = `MOCK-CMS:${documentHashHex}`
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(marker)
  throw new Error('Нет btoa: подключите модуль ЭЦП или включите mock на API')
}

type SignatureModalProps = {
  open: boolean
  onClose: () => void
  documentId: string
  documentKind: SigningDocumentKind
  /** Краткий предпросмотр (например заголовок отчёта) — без изменения макета страницы */
  previewLabel?: string | null
  onCompleted?: () => void
}

export default function SignatureModal({
  open,
  onClose,
  documentId,
  documentKind,
  previewLabel,
  onCompleted,
}: SignatureModalProps) {
  const [session, setSession] = useState<SigningRequestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySign, setBusySign] = useState(false)

  const requestMutation = useMutation({
    mutationFn: () =>
      signingApi
        .request({
          document_id: documentId,
          document_kind: documentKind,
          client_metadata: { ui: 'web', ts: new Date().toISOString() },
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setSession(data)
      setError(null)
    },
    onError: (e: unknown) => {
      setSession(null)
      setError(formatApiDetail((e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Ошибка запроса подписи')
    },
  })

  const completeMutation = useMutation({
    mutationFn: (payload: { signing_request_id: string; signature_base64: string }) =>
      signingApi
        .complete({
          signing_request_id: payload.signing_request_id,
          signature_base64: payload.signature_base64,
          certificate_pem: null,
          certificate_metadata: {
            placeholder: true,
            note: 'Сертификат с модуля ЭЦП организации подставляется при интеграции; ключ не передаётся на сервер.',
          },
        })
        .then((r) => r.data),
  })

  useEffect(() => {
    if (!open) {
      setSession(null)
      setError(null)
      setBusySign(false)
      return
    }
    if (!documentId) return
    void requestMutation.mutateAsync().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset session when document context changes
  }, [open, documentId, documentKind])

  async function onSign() {
    if (!session) return
    setBusySign(true)
    setError(null)
    try {
      const sig = localClientSignBase64(session.document_hash, session.mock_signature_base64)
      await completeMutation.mutateAsync({
        signing_request_id: session.signing_request_id,
        signature_base64: sig,
      })
      onCompleted?.()
      onClose()
    } catch (e: unknown) {
      setError(formatApiDetail((e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Ошибка завершения подписи')
    } finally {
      setBusySign(false)
    }
  }

  if (!open) return null

  return (
    <AppModal
      title="Электронная подпись"
      wide
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button type="button" className="btn-secondary min-h-12 flex-1" onClick={onClose} disabled={busySign}>
            Отмена
          </button>
          <button
            type="button"
            className="btn-primary min-h-12 flex-1"
            onClick={() => void onSign()}
            disabled={!session || busySign || requestMutation.isPending}
          >
            {busySign || completeMutation.isPending ? 'Подписываем…' : 'Подписать документ'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {previewLabel && (
          <p className="rounded-xl border border-outline-variant/20 bg-surface-container-high px-3 py-2 text-xs text-on-surface">
            {previewLabel}
          </p>
        )}
        <p className="text-xs text-on-surface-variant">
          Модель A: хэш формируется на сервере, закрытый ключ остаётся у вас (модуль ЭЦП / браузер). Здесь для проверки контура
          используется детерминированная подпись по SHA-256; для боя подключите PKCS#11 / провайдер организации.
        </p>
        {requestMutation.isPending && !session && (
          <p className="text-xs text-on-surface-variant" aria-busy="true">
            Запрос сессии подписи…
          </p>
        )}
        {error && (
          <div className="rounded-xl border border-error/25 bg-error/10 px-3 py-2 text-xs text-error" role="alert">
            {error}
          </div>
        )}
        {session && (
          <div className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-xs font-bold text-on-surface">Документ</p>
            <p className="break-all font-mono text-[11px] text-on-surface-variant">id: {session.document_id}</p>
            <p className="text-xs text-on-surface-variant">Тип: {session.document_kind}</p>
            <p className="text-xs font-bold text-on-surface">SHA-256 (hex)</p>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-container-high p-2 font-mono text-[10px] text-on-surface">
              {session.document_hash}
            </pre>
            <p className="text-xs text-on-surface-variant">
              Алгоритм: {session.algorithm} · провайдер по умолчанию: {session.default_provider ?? 'client_side'}
            </p>
            <p className="text-xs text-on-surface-variant">Действителен до: {new Date(session.expires_at).toLocaleString('ru-BY')}</p>
            <div className="rounded-lg border border-dashed border-outline-variant/40 p-3 text-[11px] text-on-surface-variant">
              <p className="mb-1 font-bold text-on-surface">Сертификат</p>
              <p>Информация о сертификате подставляется из вашего ЭЦП-клиента (не хранится на сервере до завершения подписи).</p>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}
