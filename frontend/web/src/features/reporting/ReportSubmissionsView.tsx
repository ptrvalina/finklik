import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { submissionsApi } from '../../api/client'
import { formatApiDetail } from '../../utils/apiError'
import { buildSubmissionExportActions, parseReportPeriod } from '../../utils/submissionExport'
import AppModal from '../../components/ui/AppModal'

export type ReportingAuthority = 'imns' | 'fsszn' | 'belgosstrakh' | 'belstat'

const AUTHORITY_COLORS: Record<string, string> = {
  fsszn: 'border-blue-200/90 bg-blue-50 text-blue-900',
  imns: 'border-amber-200/90 bg-amber-50 text-amber-950',
  belgosstrakh: 'border-emerald-200/90 bg-emerald-50 text-emerald-900',
  belstat: 'border-violet-200/90 bg-violet-50 text-violet-900',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-variant text-on-surface-variant',
  pending_review: 'border-amber-200/90 bg-amber-50 text-amber-950',
  confirmed: 'border-blue-200/90 bg-blue-50 text-blue-900',
  submitted: 'border-violet-200/90 bg-violet-50 text-violet-900',
  accepted: 'border-emerald-200/90 bg-emerald-50 text-emerald-900',
  rejected: 'border-red-200/90 bg-red-50 text-red-800',
}

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
}

function reportPreviewFieldOrder(k: string): number {
  const order: Record<string, number> = { warnings: 0, source: 1, form: 2, organization: 3, unp: 4, period: 5 }
  return order[k] ?? 50
}

function ReportSubmissionPreview({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data || typeof data !== 'object') {
    return <p className="text-xs text-on-surface-variant">Нет данных предпросмотра</p>
  }
  const entries = [...Object.entries(data)].sort(([a], [b]) => reportPreviewFieldOrder(a) - reportPreviewFieldOrder(b))

  return (
    <div className="space-y-3 text-xs">
      {entries.map(([k, v]) => {
        if (k === 'warnings') {
          if (!Array.isArray(v) || v.length === 0) return null
          return (
            <div key={k} className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 shadow-soft">
              <p className="mb-2 flex items-center gap-1 font-bold text-amber-950">
                <Icon name="warning" className="text-base text-amber-800" /> Предупреждения
              </p>
              <ul className="list-disc space-y-1 pl-5 text-amber-900">
                {(v as string[]).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )
        }

        if (k === 'source') {
          const ledger = v === 'ledger'
          return (
            <p key={k} className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-on-surface">Источник данных:</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                  ledger ? 'border border-secondary/30 bg-secondary/15 text-secondary' : 'border border-outline-variant/30 bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {String(v)}
              </span>
            </p>
          )
        }

        if (k === 'numeric' && typeof v === 'object' && v !== null && !Array.isArray(v)) {
          return (
            <div key={k} className="rounded-xl bg-surface-container-high p-3">
              <p className="mb-2 font-bold text-on-surface">Числовые показатели</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-on-surface-variant">{JSON.stringify(v, null, 2)}</pre>
            </div>
          )
        }

        if (Array.isArray(v)) {
          const rowsLike = k === 'rows' && v.length > 0 && typeof v[0] === 'object' && v[0] !== null
          if (rowsLike) {
            const rows = v as Record<string, unknown>[]
            const cols = Object.keys(rows[0])
            return (
              <div key={k} className="overflow-x-auto rounded-xl bg-surface-container-low p-3">
                <p className="mb-2 font-bold text-on-surface">{k}</p>
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                      {cols.map((hk) => (
                        <th key={hk} className="pb-2 pr-3 font-semibold">
                          {hk}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-outline-variant/10">
                        {cols.map((hk) => (
                          <td key={hk} className="py-2 pr-3 align-top">
                            {String(row[hk] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          return (
            <div key={k} className="rounded-xl bg-surface-container-low p-3">
              <p className="mb-1 font-bold text-on-surface">{k}</p>
              <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
                {(v as unknown[]).map((item, i) => (
                  <li key={i}>{typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)}</li>
                ))}
              </ul>
            </div>
          )
        }

        if (typeof v === 'object' && v !== null) {
          return (
            <div key={k} className="rounded-xl bg-surface-container-low p-3">
              <p className="mb-1 font-bold text-on-surface">{k}</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-on-surface-variant">{JSON.stringify(v, null, 2)}</pre>
            </div>
          )
        }

        return (
          <p key={k} className="break-words">
            <span className="font-bold text-on-surface">{k}:</span> <span className="text-on-surface-variant">{String(v)}</span>
          </p>
        )
      })}
    </div>
  )
}

const AUTH_KEYS: ReportingAuthority[] = ['imns', 'fsszn', 'belgosstrakh', 'belstat']

function authorityShortLabel(auth: string) {
  return auth === 'fsszn' ? 'ФСЗН' : auth === 'imns' ? 'ИМНС' : auth === 'belgosstrakh' ? 'Белгосстрах' : 'Белстат'
}

export default function ReportSubmissionsView({ authorityFilter }: { authorityFilter: ReportingAuthority | null }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    authority: (authorityFilter || 'fsszn') as string,
    report_type: 'pu-3',
    report_period: `${new Date().getFullYear()}-Q1`,
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [exportLoading, setExportLoading] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', authorityFilter ?? 'all'],
    queryFn: () =>
      submissionsApi.list(authorityFilter ? { authority: authorityFilter } : undefined).then((r) => r.data),
  })

  const { data: reportTypesData } = useQuery({
    queryKey: ['report-types'],
    queryFn: () => submissionsApi.getReportTypes().then((r) => r.data),
  })

  const reportTypes: Record<string, Record<string, string>> = reportTypesData?.report_types ?? {}

  useEffect(() => {
    if (!authorityFilter) return
    setCreateForm((prev) => {
      const types = reportTypes[authorityFilter] || {}
      const keys = Object.keys(types)
      const nextType = keys.includes(prev.report_type) ? prev.report_type : keys[0] || ''
      return { ...prev, authority: authorityFilter, report_type: nextType }
    })
  }, [authorityFilter, reportTypes])

  const snapshotEnabled =
    !!previewData?.id &&
    (previewData.status === 'accepted' || previewData.status === 'rejected') &&
    !!previewData.has_submission_snapshot

  const snapshotQuery = useQuery({
    queryKey: ['submission-snapshot', previewData?.id],
    queryFn: () => submissionsApi.get(previewData!.id, { include_snapshot: true }).then((r) => r.data),
    enabled: snapshotEnabled,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      submissionsApi.create({
        ...createForm,
        authority: authorityFilter ?? createForm.authority,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      setShowCreate(false)
      setPreviewData(res.data)
      flash('success', 'Отчёт сформирован — проверьте и подтвердите')
    },
    onError: (e: any) => flash('error', formatApiDetail(e.response?.data?.detail) || 'Ошибка'),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => submissionsApi.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      flash('success', 'Отчёт подтверждён')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { id: string; portal_sim?: 'accept' | 'reject' }) =>
      submissionsApi.submit(payload.id, payload.portal_sim ? { portal_sim: payload.portal_sim } : undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      const rejected = res.data?.status === 'rejected'
      flash(
        rejected ? 'error' : 'success',
        res.data?.message || (rejected ? 'Портал отклонил отчёт' : 'Отчёт отправлен'),
      )
    },
    onError: (e: any) => flash('error', formatApiDetail(e.response?.data?.detail) || 'Ошибка отправки'),
  })
  const autoSubmitMutation = useMutation({
    mutationFn: () => submissionsApi.autoSubmit(30),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      const payload = res.data || {}
      flash(
        'success',
        `Автоподача: отправлено ${payload.submitted ?? 0}, пропущено ${payload.skipped ?? 0}`,
      )
    },
    onError: (e: any) => flash('error', formatApiDetail(e.response?.data?.detail) || 'Ошибка автоподачи'),
  })

  const rejectMutation = useMutation({
    mutationFn: (args: { id: string; reason?: string; returnToDraftFromRejected?: boolean }) =>
      submissionsApi.reject(args.id, args.reason),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      flash('success', vars.returnToDraftFromRejected ? 'Отчёт снова в черновике' : 'Отчёт отклонён')
    },
    onError: (e: any) => flash('error', formatApiDetail(e.response?.data?.detail) || 'Ошибка'),
  })

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 6000)
  }

  const submissions = data?.submissions ?? []
  const confirmedCount = submissions.filter((s: any) => s.status === 'confirmed').length
  const statsKeys = authorityFilter ? [authorityFilter] : AUTH_KEYS
  const currentAuthorityTypes = reportTypes[createForm.authority] || {}

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === 'success'
              ? 'border border-secondary/20 bg-secondary/10 text-secondary'
              : 'border border-error/20 bg-error/10 text-error'
          }`}
        >
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-bold text-on-surface">Автоматическая подача отчётов</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {authorityFilter ? `Орган: ${authorityShortLabel(authorityFilter)}` : 'ФСЗН · ИМНС · Белгосстрах · Белстат'}
          </p>
          <p className="mt-1 text-[11px] text-secondary">
            Готово к автоподаче: {confirmedCount}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <Icon name="add" className="text-lg" /> Сформировать отчёт
          </button>
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={() => autoSubmitMutation.mutate()}
            disabled={autoSubmitMutation.isPending || confirmedCount === 0}
          >
            <Icon name="auto_mode" className="text-lg" />
            {autoSubmitMutation.isPending ? 'Автоподача...' : 'Автоподать готовые'}
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 px-4 py-3 text-xs text-blue-900">
        Автоподача работает только для валидных и подтверждённых пакетов; ошибки автоматически возвращаются в контур проверки.
      </div>

      <div className="rounded-xl bg-surface-container-low p-3 sm:p-4">
        <div className={`grid gap-2 sm:gap-3 ${statsKeys.length === 1 ? 'grid-cols-1 sm:max-w-xs' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {statsKeys.map((auth) => {
            const count = submissions.filter((s: any) => s.authority === auth).length
            const pending = submissions.filter((s: any) => s.authority === auth && s.status === 'pending_review').length
            return (
              <div key={auth} className="rounded-lg bg-surface-container-high p-4 text-center">
                <p className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${AUTHORITY_COLORS[auth]}`}>
                  {authorityShortLabel(auth)}
                </p>
                <p className="mt-2 text-2xl font-bold text-on-surface">{count}</p>
                <p className="text-[10px] text-on-surface-variant">отчётов</p>
                {pending > 0 && <p className="mt-1 text-[10px] font-semibold text-amber-800">{pending} на проверке</p>}
              </div>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-surface-container-low p-12 text-center text-sm text-on-surface-variant">Загрузка...</div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl bg-surface-container-low p-16 text-center">
          <Icon name="send" className="text-5xl text-on-surface-variant/20" />
          <p className="mt-4 text-sm text-on-surface-variant">Отчётов ещё нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s: any) => (
            <div key={s.id} className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${AUTHORITY_COLORS[s.authority] || ''}`}>
                      {s.authority_name}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[s.status] || ''}`}>
                      {s.status_label}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface">{s.report_type_name}</h3>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Период: {s.report_period} · Создан: {new Date(s.created_at).toLocaleDateString('ru-BY')}
                  </p>
                  {s.submission_ref && <p className="mt-1 text-xs text-secondary">Референс: {s.submission_ref}</p>}
                  {s.rejection_reason && <p className="mt-1 text-xs text-error">Причина: {s.rejection_reason}</p>}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {(s.status === 'pending_review' || s.status === 'confirmed' || s.status === 'accepted' || s.status === 'rejected') && (
                    <button type="button" onClick={() => setPreviewData(s)} className="btn-ghost !text-xs">
                      <Icon name="visibility" className="text-sm" /> Просмотр
                    </button>
                  )}
                  {s.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => rejectMutation.mutate({ id: s.id, returnToDraftFromRejected: true })}
                      className="btn-secondary !py-1.5 !text-xs"
                      disabled={rejectMutation.isPending}
                    >
                      <Icon name="edit_note" className="text-sm" /> В черновик
                    </button>
                  )}
                  {s.status === 'pending_review' && (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmMutation.mutate(s.id)}
                        className="btn-primary !py-1.5 !text-xs"
                        disabled={confirmMutation.isPending}
                      >
                        <Icon name="check" className="text-sm" /> Подтвердить
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectMutation.mutate({ id: s.id })}
                        className="btn-ghost !text-xs text-error"
                        disabled={rejectMutation.isPending}
                      >
                        <Icon name="close" className="text-sm" />
                      </button>
                    </>
                  )}
                  {s.status === 'confirmed' && (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      {import.meta.env.DEV && (
                        <div className="flex gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-high px-1 py-0.5">
                          <button
                            type="button"
                            title="DEV: мок-портал примет (DEBUG на API)"
                            onClick={() => submitMutation.mutate({ id: s.id, portal_sim: 'accept' })}
                            className="btn-ghost !px-2 !py-1 !text-[10px] text-secondary"
                            disabled={submitMutation.isPending}
                          >
                            accept
                          </button>
                          <button
                            type="button"
                            title="DEV: мок-портал отклонит (DEBUG на API)"
                            onClick={() => submitMutation.mutate({ id: s.id, portal_sim: 'reject' })}
                            className="btn-ghost !px-2 !py-1 !text-[10px] text-error"
                            disabled={submitMutation.isPending}
                          >
                            reject
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => submitMutation.mutate({ id: s.id })}
                        className="btn-primary !py-1.5 !text-xs"
                        disabled={submitMutation.isPending}
                      >
                        <Icon name="send" className="text-sm" /> Отправить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <AppModal
          title="Сформировать отчёт"
          wide
          onClose={() => setShowCreate(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowCreate(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary min-h-12 flex-1"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Формируем...' : 'Сформировать'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Орган</label>
              {authorityFilter ? (
                <p className="rounded-xl border border-outline-variant/20 bg-surface-container-high px-3 py-2.5 text-sm font-bold text-on-surface">
                  {authorityShortLabel(authorityFilter)}
                </p>
              ) : (
                <select
                  className="input min-h-11 rounded-xl"
                  value={createForm.authority}
                  onChange={(e) => {
                    const auth = e.target.value
                    const types = reportTypes[auth] || {}
                    setCreateForm({ ...createForm, authority: auth, report_type: Object.keys(types)[0] || '' })
                  }}
                >
                  <option value="fsszn">ФСЗН</option>
                  <option value="imns">ИМНС</option>
                  <option value="belgosstrakh">Белгосстрах</option>
                  <option value="belstat">Белстат</option>
                </select>
              )}
            </div>
            <div>
              <label className="label">Тип отчёта</label>
              <select
                className="input min-h-11 rounded-xl"
                value={createForm.report_type}
                onChange={(e) => setCreateForm({ ...createForm, report_type: e.target.value })}
              >
                {Object.entries(currentAuthorityTypes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Период</label>
              <select
                className="input min-h-11 rounded-xl"
                value={createForm.report_period}
                onChange={(e) => setCreateForm({ ...createForm, report_period: e.target.value })}
              >
                {[0, 1].map((dy) => {
                  const y = new Date().getFullYear() - dy
                  return (
                    <optgroup key={`q-${y}`} label={`Кварталы ${y}`}>
                      {[1, 2, 3, 4].map((q) => (
                        <option key={`${y}-Q${q}`} value={`${y}-Q${q}`}>
                          Q{q}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
                {[0, 1].map((dy) => {
                  const y = new Date().getFullYear() - dy
                  return (
                    <optgroup key={`m-${y}`} label={`Месяцы ${y}`}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1
                        const mm = m < 10 ? `0${m}` : `${m}`
                        return (
                          <option key={`${y}-M${mm}`} value={`${y}-M${mm}`}>
                            Месяц {mm}
                          </option>
                        )
                      })}
                    </optgroup>
                  )
                })}
              </select>
            </div>
            {(() => {
              const parsed = parseReportPeriod(createForm.report_period)
              if (!parsed || parsed.kind !== 'month') return null
              const quarterFile =
                (createForm.authority === 'fsszn' && createForm.report_type === 'pu-3') ||
                (createForm.authority === 'imns' && createForm.report_type === 'vat-declaration')
              if (!quarterFile) return null
              return (
                <div className="flex gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-[11px] leading-snug text-amber-950 shadow-soft">
                  <Icon name="info" className="shrink-0 text-lg text-amber-800" />
                  <span>
                    Выбран <strong className="text-amber-950">месяц</strong>: расчёт черновика отчёта идёт за этот месяц. Файлы НДС и ПУ-3 в разделе «Документы»
                    формируются за <strong className="text-amber-950">весь квартал</strong>, в который попадает месяц — учитывайте при сверке.
                  </span>
                </div>
              )
            })()}
          </div>
        </AppModal>
      )}

      {previewData && (
        <AppModal
          title="Предпросмотр отчёта"
          wide
          onClose={() => setPreviewData(null)}
          footer={
            previewData.status === 'pending_review' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  className="btn-ghost min-h-12 flex-1 text-error"
                  onClick={() => {
                    rejectMutation.mutate({ id: previewData.id })
                    setPreviewData(null)
                  }}
                >
                  Отклонить
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  onClick={() => {
                    confirmMutation.mutate(previewData.id)
                    setPreviewData(null)
                  }}
                >
                  Подтвердить
                </button>
              </div>
            ) : previewData.status === 'rejected' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  onClick={() => {
                    rejectMutation.mutate({ id: previewData.id, returnToDraftFromRejected: true })
                    setPreviewData(null)
                  }}
                  disabled={rejectMutation.isPending}
                >
                  В черновик
                </button>
                <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setPreviewData(null)}>
                  Закрыть
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary min-h-12 w-full" onClick={() => setPreviewData(null)}>
                Закрыть
              </button>
            )
          }
        >
          {(() => {
            const exportActions = buildSubmissionExportActions({
              authority: previewData.authority,
              report_type: previewData.report_type,
              report_period: previewData.report_period,
              report_data: previewData.report_data,
            })
            const snap = snapshotQuery.data?.submission_snapshot
            const snapReport = snap?.report_data
            const exportArchive = snapReport
              ? buildSubmissionExportActions({
                  authority: previewData.authority,
                  report_type: previewData.report_type,
                  report_period: previewData.report_period,
                  report_data: snapReport,
                })
              : []

            function renderExportBlock(
              actions: ReturnType<typeof buildSubmissionExportActions>,
              title: string,
              keyPrefix: 'cur' | 'arc',
            ) {
              if (actions.length === 0) return null
              return (
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-high p-4">
                  <p className="mb-3 text-xs font-bold text-on-surface">{title}</p>
                  <div className="flex flex-wrap gap-3">
                    {actions.map((ex) => (
                      <div key={`${keyPrefix}-${ex.key}`} className="flex min-w-[140px] flex-col gap-1">
                        <button
                          type="button"
                          className="btn-secondary !py-2 !text-xs"
                          disabled={exportLoading !== null}
                          onClick={async () => {
                            try {
                              setExportLoading(`${keyPrefix}:${ex.key}`)
                              await ex.run()
                              flash('success', 'Файл сохранён')
                            } catch (e: any) {
                              flash('error', formatApiDetail(e.response?.data?.detail) || 'Ошибка скачивания')
                            } finally {
                              setExportLoading(null)
                            }
                          }}
                        >
                          {exportLoading === `${keyPrefix}:${ex.key}` ? 'Скачивание…' : ex.label}
                        </button>
                        {ex.hint && <span className="text-[10px] leading-snug text-on-surface-variant">{ex.hint}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <div className="space-y-4">
                {renderExportBlock(
                  exportActions,
                  'Скачать файл (текущие данные заявки, как в «Документы»)',
                  'cur',
                )}
                {snapshotEnabled && (
                  <div className="rounded-xl border border-secondary/25 bg-secondary/5 p-4">
                    <p className="mb-1 flex items-center gap-2 text-xs font-bold text-secondary">
                      <Icon name="archive" className="text-base" /> Архив на момент отправки в портал
                    </p>
                    {snapshotQuery.isLoading && <p className="text-xs text-on-surface-variant">Загрузка архива…</p>}
                    {snapshotQuery.isError && (
                      <p className="text-xs text-error">Не удалось загрузить архив. Попробуйте закрыть и открыть снова.</p>
                    )}
                    {snapshotQuery.isSuccess && !snap && (
                      <p className="text-xs text-on-surface-variant">Снимок не сохранён (например, заявка до миграции).</p>
                    )}
                    {snap && (
                      <>
                        <p className="mb-3 text-[10px] text-on-surface-variant">
                          {snap.captured_at
                            ? new Date(snap.captured_at).toLocaleString('ru-BY', { dateStyle: 'short', timeStyle: 'short' })
                            : ''}
                          {snap.portal_outcome ? ` · исход: ${snap.portal_outcome}` : ''}
                          {snap.submission_ref ? ` · реф. ${snap.submission_ref}` : ''}
                        </p>
                        {renderExportBlock(exportArchive, 'Скачать файл по данным из архива (как при подаче)', 'arc')}
                        <div className="mt-2 rounded-lg bg-surface-container-low p-4">
                          <ReportSubmissionPreview data={snapReport} />
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="rounded-lg bg-surface-container-low p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    {snapshotEnabled ? 'Текущие данные в заявке' : 'Данные отчёта'}
                  </p>
                  <ReportSubmissionPreview data={previewData.report_data} />
                </div>
              </div>
            )
          })()}
        </AppModal>
      )}
    </div>
  )
}
