import { useEffect, useMemo, useRef, useState } from 'react'
import { employeesApi, scannerApi, workforceApi } from '../../api/client'
import { saveBlob } from '../../utils/fileDownload'
import { calmActionError } from '../../i18n/messages.ru'
import { formatApiDetail } from '../../utils/apiError'
import MoneyAmount from '../../components/ui/MoneyAmount'

type Row = {
  id: string
  full_name: string
  position: string
  is_active: boolean
  hire_date?: string
  hr_meta?: Record<string, unknown>
}

function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [keys.join(';'), ...rows.map((r) => keys.map((k) => esc(r[k] as string | number)).join(';'))].join('\n')
}

const emptyIdDoc = { series: '', number: '', issued_by: '', issued_date: '', expiry_date: '' }

export default function EmployeesHire() {
  const passportRef = useRef<HTMLInputElement>(null)
  const disabilityRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [consent, setConsent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [seqInfo, setSeqInfo] = useState<{ hire_next_label?: string } | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [pu2Map, setPu2Map] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    identification_number: '',
    passport_data: '',
    id_document_type: '' as '' | 'passport' | 'residence_permit' | 'refugee_certificate' | 'other',
    id_doc: { ...emptyIdDoc },
    position: '',
    position_code: '',
    position_name: '',
    salary: '',
    hire_date: new Date().toISOString().slice(0, 10),
    has_children: 0,
    disability: '' as '' | '1' | '2' | '3',
    subdivision: '',
    employment_type: '' as '' | 'primary' | 'secondary',
    bank_account: '',
    contract_number: '',
    contract_date: '',
    hire_order_number: '',
    hire_order_date: '',
    bonuses_contract: '',
    dependents_children: '' as string,
    dependents_other: '' as string,
    disability_certificate_text: '',
  })

  const [editId, setEditId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState<Record<string, unknown>>({})
  const [wizardStep, setWizardStep] = useState(1)
  const wizardSteps = ['Личные данные', 'Должность и оклад', 'Документы', 'Подтверждение']

  const [exportRange, setExportRange] = useState({
    employeeId: '',
    yf: new Date().getFullYear(),
    mf: 1,
    yt: new Date().getFullYear(),
    mt: new Date().getMonth() + 1,
  })

  async function load() {
    setLoading(true)
    try {
      const [{ data: list }, { data: seq }] = await Promise.all([
        employeesApi.list({ active_only: false }),
        employeesApi.hrSequences().catch(() => ({ data: null })),
      ])
      setRows((list || []) as Row[])
      setSeqInfo(seq)
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Не удалось загрузить список')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const idPayload = useMemo(() => {
    const d = form.id_doc
    if (!form.id_document_type) return null
    if (!d.number.trim() || !d.issued_by.trim() || !d.issued_date) return null
    return {
      series: d.series || null,
      number: d.number.trim(),
      issued_by: d.issued_by.trim(),
      issued_date: d.issued_date,
      expiry_date: d.expiry_date || null,
    }
  }, [form.id_document_type, form.id_doc])

  async function handleCreate() {
    if (!consent) {
      alert('Нужно согласие на обработку персональных данных.')
      return
    }
    if (!form.full_name.trim() || !form.position.trim() || Number(form.salary) <= 0) {
      alert('Укажите ФИО, должность (поле «должность») и оклад больше 0.')
      return
    }
    if (form.id_document_type && !idPayload) {
      alert('Заполните реквизиты документа (номер, кем выдан, дата выдачи) или снимите тип документа.')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      const hr: Record<string, unknown> = {
        subdivision: form.subdivision || null,
        employment_type: form.employment_type || null,
        bank_account: form.bank_account || null,
        contract_number: form.contract_number || null,
        contract_date: form.contract_date || null,
        hire_order_number: form.hire_order_number || null,
        hire_order_date: form.hire_order_date || null,
        bonuses_contract: form.bonuses_contract || null,
        dependents_children: form.dependents_children ? Number(form.dependents_children) : null,
        dependents_other: form.dependents_other ? Number(form.dependents_other) : null,
        disability_certificate_text: form.disability_certificate_text || null,
      }
      await employeesApi.create({
        full_name: form.full_name.trim(),
        identification_number: form.identification_number.trim() || null,
        position: form.position.trim(),
        position_code: form.position_code.trim() || null,
        position_name: (form.position_name || form.position).trim(),
        salary: Number(form.salary),
        hire_date: form.hire_date,
        has_children: Number(form.dependents_children || 0),
        disability_group: form.disability ? Number(form.disability) : null,
        passport_data: form.passport_data.trim() || null,
        phone: form.phone.trim() || null,
        id_document_type: form.id_document_type || null,
        id_document: idPayload,
        hr: hr,
      })
      await load()
      setForm((f) => ({
        ...f,
        full_name: '',
        phone: '',
        identification_number: '',
        passport_data: '',
        id_document_type: '',
        id_doc: { ...emptyIdDoc },
        position_code: '',
        position_name: '',
        salary: '',
        subdivision: '',
        employment_type: '',
        bank_account: '',
        contract_number: '',
        contract_date: '',
        hire_order_number: '',
        hire_order_date: '',
        bonuses_contract: '',
        dependents_children: '',
        dependents_other: '',
        disability_certificate_text: '',
        disability: '',
      }))
      setConsent(false)
      setWizardStep(1)
    } catch (e: any) {
      const m = e?.response?.data?.detail
      setErr(typeof m === 'string' ? m : 'Ошибка при создании')
      alert(typeof m === 'string' ? m : 'Ошибка при создании')
    } finally {
      setSubmitting(false)
    }
  }

  async function scanPassport() {
    try {
      const file = passportRef.current?.files?.[0]
      if (file) await scannerApi.upload(file)
      setForm((f) => ({
        ...f,
        passport_data: f.passport_data || 'Серия MP, № 1234567, выдан Фрунзенским РУВД 12.04.2022',
        id_document_type: (f.id_document_type || 'passport') as typeof f.id_document_type,
      }))
    } catch {
      alert('Сканер недоступен. Введите данные вручную.')
    }
  }

  async function scanDisability() {
    try {
      const file = disabilityRef.current?.files?.[0]
      if (file) await scannerApi.upload(file)
      setForm((f) => ({
        ...f,
        disability_certificate_text:
          f.disability_certificate_text || 'Инвалидное удостоверение: серия, №, срок, группа (данные из скана).',
      }))
    } catch {
      alert('Сканер недоступен.')
    }
  }

  async function openEdit(id: string) {
    try {
      const { data } = await employeesApi.get(id)
      setEditId(id)
      setEditBody(data)
    } catch {
      alert('Не удалось открыть карточку')
    }
  }

  async function saveEdit() {
    if (!editId) return
    const d = editBody as any
    try {
      await employeesApi.update(editId, {
        full_name: d.full_name,
        position: d.position,
        position_code: d.position_code,
        position_name: d.position_name,
        salary: Number(d.salary),
        passport_data: d.passport_data,
        phone: d.phone,
        email: d.email,
        address: d.address,
        has_children: d.has_children,
        disability_group: d.disability_group,
        identification_number: d.identification_number,
        hr_meta_patch: d.hr_meta,
      })
      setEditId(null)
      await load()
    } catch (e: any) {
      alert(calmActionError('employeeSave', formatApiDetail(e?.response?.data?.detail)))
    }
  }

  async function pu2Selected() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!ids.length) {
      alert('Отметьте сотрудников')
      return
    }
    for (const id of ids) {
      try {
        const { data } = await workforceApi.sendPu2({ employee_id: id, xml_data: `<PU2 hire="true" emp="${id}" />` })
        setPu2Map((m) => ({ ...m, [id]: data?.status || 'ok' }))
      } catch {
        setPu2Map((m) => ({ ...m, [id]: 'error' }))
      }
    }
  }

  async function downloadOrderDocx(employeeId: string) {
    try {
      const { data } = await employeesApi.downloadHireOrder(employeeId)
      saveBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `prikaz_o_prieme_${employeeId.slice(0, 8)}.docx`)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Не удалось сформировать приказ')
    }
  }

  async function exportPayroll() {
    if (!exportRange.employeeId) {
      alert('Выберите сотрудника для выписки')
      return
    }
    try {
      const { data } = await employeesApi.salaryRecords(exportRange.employeeId, {
        year_from: exportRange.yf,
        month_from: exportRange.mf,
        year_to: exportRange.yt,
        month_to: exportRange.mt,
      })
      const recs = (data || []) as any[]
      const emp = rows.find((r) => r.id === exportRange.employeeId)
      const lines = recs.map((r) => ({
        period: `${r.period_month}.${r.period_year}`,
        base: r.base_salary,
        bonus: r.bonus,
        gross: r.gross_salary,
        net: r.net_salary,
        tax: r.income_tax,
        fsszn: r.fsszn_employee,
        status: r.status,
      }))
      const csv = toCsv(lines)
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      saveBlob(
        blob,
        `payroll_${(emp?.full_name || 'employee').replace(/\s+/g, '_')}_${exportRange.yf}${exportRange.mf}-${exportRange.yt}${exportRange.mt}.csv`,
      )
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Нет данных за период')
    }
  }

  return (
    <div className="space-y-6">
      {rows.length === 0 && !loading && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold text-on-surface">Первый сотрудник</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Заполните анкету по шагам — минимум: ФИО, должность и оклад.
          </p>
        </div>
      )}

      {seqInfo?.hire_next_label ? (
        <p className="text-sm text-on-surface-variant">
          Следующий номер приказа:{' '}
          <span className="font-medium text-on-surface">{seqInfo.hire_next_label}</span>
        </p>
      ) : null}

      <div className="card-elevated space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Приём сотрудника</h2>
          <span className="text-xs font-bold text-on-surface-variant">
            Шаг {wizardStep} из {wizardSteps.length}: {wizardSteps[wizardStep - 1]}
          </span>
        </div>
        <div className="flex gap-1">
          {wizardSteps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i + 1 <= wizardStep ? 'bg-primary' : 'bg-outline/30'}`} />
          ))}
        </div>

        {wizardStep === 1 && (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input md:col-span-2" placeholder="ФИО *" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
            <input className="input" placeholder="Телефон" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <input className="input" placeholder="Идентификационный номер" value={form.identification_number} onChange={(e) => setForm((p) => ({ ...p, identification_number: e.target.value }))} />
          </div>
        )}

        {wizardStep === 2 && (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Должность (кратко) *" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} />
            <input className="input" type="number" step="0.01" placeholder="Оклад *" value={form.salary} onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))} />
            <input className="input" type="date" value={form.hire_date} onChange={(e) => setForm((p) => ({ ...p, hire_date: e.target.value }))} />
            <input className="input" placeholder="Подразделение" value={form.subdivision} onChange={(e) => setForm((p) => ({ ...p, subdivision: e.target.value }))} />
            <select className="input" value={form.employment_type} onChange={(e) => setForm((p) => ({ ...p, employment_type: e.target.value as any }))}>
              <option value="">Трудоустройство</option>
              <option value="primary">Основное место</option>
              <option value="secondary">По совместительству</option>
            </select>
            <input className="input" placeholder="Расчётный счёт" value={form.bank_account} onChange={(e) => setForm((p) => ({ ...p, bank_account: e.target.value }))} />
          </div>
        )}

        {wizardStep === 3 && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="input md:col-span-2" value={form.id_document_type} onChange={(e) => setForm((p) => ({ ...p, id_document_type: e.target.value as any }))}>
                <option value="">Документ (необязательно)</option>
                <option value="passport">Паспорт</option>
                <option value="residence_permit">Вид на жительство</option>
                <option value="other">Иной</option>
              </select>
              {form.id_document_type ? (
                <>
                  <input className="input" placeholder="Серия" value={form.id_doc.series} onChange={(e) => setForm((p) => ({ ...p, id_doc: { ...p.id_doc, series: e.target.value } }))} />
                  <input className="input" placeholder="Номер *" value={form.id_doc.number} onChange={(e) => setForm((p) => ({ ...p, id_doc: { ...p.id_doc, number: e.target.value } }))} />
                  <input className="input md:col-span-2" placeholder="Кем выдан *" value={form.id_doc.issued_by} onChange={(e) => setForm((p) => ({ ...p, id_doc: { ...p.id_doc, issued_by: e.target.value } }))} />
                </>
              ) : null}
              <textarea className="input md:col-span-2 min-h-[56px]" placeholder="Паспортные данные" value={form.passport_data} onChange={(e) => setForm((p) => ({ ...p, passport_data: e.target.value }))} />
            </div>
            <input ref={passportRef} type="file" accept="image/*,.pdf" className="hidden" onChange={() => void scanPassport()} />
            <button type="button" className="btn-secondary" onClick={() => passportRef.current?.click()}>
              Скан паспорта
            </button>
          </>
        )}

        {wizardStep === 4 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-outline/60 bg-surface-container-low/50 p-4 text-sm">
              <p><span className="text-on-surface-variant">ФИО:</span> {form.full_name || '—'}</p>
              <p><span className="text-on-surface-variant">Должность:</span> {form.position || '—'}</p>
              <p><span className="text-on-surface-variant">Оклад:</span> {form.salary ? <MoneyAmount value={form.salary} className="inline-flex" /> : '—'}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Согласие на обработку персональных данных
            </label>
            {err ? <p className="text-sm text-rose-500">{err}</p> : null}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <button type="button" className="btn-secondary" disabled={wizardStep === 1} onClick={() => setWizardStep((s) => s - 1)}>
            Назад
          </button>
          {wizardStep < 4 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (wizardStep === 1 && !form.full_name.trim()) {
                  alert('Укажите ФИО')
                  return
                }
                if (wizardStep === 2 && (!form.position.trim() || Number(form.salary) <= 0)) {
                  alert('Укажите должность и оклад')
                  return
                }
                setWizardStep((s) => s + 1)
              }}
            >
              Далее
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={submitting} onClick={() => void handleCreate()}>
              {submitting ? 'Сохранение…' : 'Принять сотрудника'}
            </button>
          )}
        </div>
      </div>

      <div className="card-elevated space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Принятые сотрудники</h2>
          <button type="button" className="btn-secondary text-sm" disabled={loading} onClick={() => void load()}>
            Обновить
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => void pu2Selected()}>
            ПУ-2 по выбранным
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-outline/60">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container-low text-left">
              <tr>
                <th className="px-2 py-2 w-10" />
                <th className="px-3 py-2">ФИО</th>
                <th className="px-3 py-2">Должность</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">ПУ-2</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-outline/60">
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={!!selected[r.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} />
                  </td>
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2">{r.position}</td>
                  <td className="px-3 py-2">{r.is_active ? 'Активен' : 'Уволен'}</td>
                  <td className="px-3 py-2 text-xs">{pu2Map[r.id] || '—'}</td>
                  <td className="px-3 py-2 flex flex-wrap gap-1">
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void openEdit(r.id)}>
                      Карточка
                    </button>
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void downloadOrderDocx(r.id)}>
                      Приказ DOCX
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-outline/60 p-4 space-y-2">
          <p className="text-sm font-medium text-on-surface">Выписка из расчётной ведомости (CSV)</p>
          <div className="flex flex-wrap gap-2 items-end">
            <select className="input w-56" value={exportRange.employeeId} onChange={(e) => setExportRange((x) => ({ ...x, employeeId: e.target.value }))}>
              <option value="">Сотрудник</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
            <input className="input w-24" type="number" value={exportRange.yf} onChange={(e) => setExportRange((x) => ({ ...x, yf: Number(e.target.value) }))} />
            <input className="input w-20" type="number" min={1} max={12} value={exportRange.mf} onChange={(e) => setExportRange((x) => ({ ...x, mf: Number(e.target.value) }))} />
            <span className="text-on-surface-variant">—</span>
            <input className="input w-24" type="number" value={exportRange.yt} onChange={(e) => setExportRange((x) => ({ ...x, yt: Number(e.target.value) }))} />
            <input className="input w-20" type="number" min={1} max={12} value={exportRange.mt} onChange={(e) => setExportRange((x) => ({ ...x, mt: Number(e.target.value) }))} />
            <button type="button" className="btn-secondary" onClick={() => void exportPayroll()}>
              Скачать CSV
            </button>
          </div>
        </div>
      </div>

      {editId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 space-y-3">
            <h3 className="text-lg font-semibold">Карточка сотрудника</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {(['full_name', 'phone', 'passport_data', 'position', 'position_code', 'position_name'] as const).map((k) => (
                <label key={k} className="text-xs text-on-surface-variant">
                  {k}
                  <input
                    className="input mt-1"
                    value={String((editBody as any)[k] ?? '')}
                    onChange={(e) => setEditBody((b) => ({ ...b, [k]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="text-xs text-on-surface-variant md:col-span-2">
                hr_meta (JSON)
                <textarea
                  className="input mt-1 font-mono text-xs min-h-[120px]"
                  value={JSON.stringify((editBody as any).hr_meta || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      setEditBody((b) => ({ ...b, hr_meta: parsed }))
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={() => void saveEdit()}>
                Сохранить
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditId(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
