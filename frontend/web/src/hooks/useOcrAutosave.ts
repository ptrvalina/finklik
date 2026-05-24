import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { scannerApi } from '../api/client'
import { draftToCorrectionPayload, type OcrEditDraft } from '../lib/ocrCorrectionFields'

export function useOcrAutosave({
  docId,
  draft,
  correctedFields,
  category,
  debitAccount,
  creditAccount,
  enabled,
  onSaved,
}: {
  docId: string | null | undefined
  draft: OcrEditDraft | null
  correctedFields: Set<string> | string[]
  category?: string
  debitAccount?: string
  creditAccount?: string
  enabled?: boolean
  onSaved?: (data: unknown) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPayload = useRef('')

  const save = useMutation({
    mutationFn: (payload: ReturnType<typeof draftToCorrectionPayload>) =>
      scannerApi.patchCorrections(docId!, payload).then((r) => r.data),
    onSuccess: (data) => onSaved?.(data),
  })

  useEffect(() => {
    if (!enabled || !docId || !draft) return
    const fields = correctedFields instanceof Set ? [...correctedFields] : correctedFields
    const payload = draftToCorrectionPayload(draft, fields, {
      category,
      debit_account: debitAccount,
      credit_account: creditAccount,
    })
    const key = JSON.stringify(payload)
    if (key === lastPayload.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastPayload.current = key
      if (fields.length > 0) save.mutate(payload)
    }, 700)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [docId, draft, correctedFields, category, debitAccount, creditAccount, enabled])

  return { saving: save.isPending, saveError: save.isError }
}
