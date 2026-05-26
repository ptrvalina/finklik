import { useEffect, useMemo, useState } from 'react'
import { employeesApi, workforceApi } from '../../api/client'
import { BELARUS_DISMISSAL_REASONS } from '../../data/belarusDismissalReasons'
import { calmActionError } from '../../i18n/messages.ru'
import { formatApiDetail } from '../../utils/apiError'

type Emp = { id: string; full_name: string; position: string; is_active: boolean; hr_meta?: Record<string, unknown> }

export default function EmployeesDismiss() {
  const [rows, setRows] = useState<Emp[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [terminationDate, setTerminationDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reasonCode, setReasonCode] = useState(BELARUS_DISMISSAL_REASONS[0]?.code || '')
  const [busy, setBusy] = useState(false)
  const [seq, setSeq] = useState<{ fire_next_label?: string } | null>(null)

  async function load() {
    const [{ data }, seqRes] = await Promise.all([
      employeesApi.list({ active_only: true }),
      employeesApi.hrSequences().catch(() => ({ data: null })),
    ])
    setRows((data || []) as Emp[])
    setSeq(seqRes.data)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => r.full_name.toLowerCase().includes(s))
  }, [rows, q])

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[0], id]
      return [...prev, id]
    })
  }

  const reasonLabel = useMemo(
    () => BELARUS_DISMISSAL_REASONS.find((r) => r.code === reasonCode)?.label || '',
    [reasonCode],
  )

  async function submit() {
    if (!selected.length) {
      alert('Выберите одного или двух сотрудников')
      return
    }
    if (!confirm('Подтвердить увольнение?')) return
    setBusy(true)
    try {
      if (selected.length === 1) {
        await workforceApi.terminate(selected[0], {
          termination_date: terminationDate,
          dismissal_reason_code: reasonCode,
          dismissal_reason_label: reasonLabel,
        })
        await workforceApi.sendPu2({
          employee_id: selected[0],
          xml_data: `<PU2 termination="true" emp="${selected[0]}" />`,
        })
      } else {
        await workforceApi.bulkTerminate({
          employee_ids: selected,
          termination_date: terminationDate,
          dismissal_reason_code: reasonCode,
          dismissal_reason_label: reasonLabel,
        })
        for (const id of selected) {
          await workforceApi.sendPu2({ employee_id: id, xml_data: `<PU2 termination="true" emp="${id}" />` })
        }
      }
      setSelected([])
      await load()
      alert('Готово')
    } catch (e: any) {
      alert(calmActionError('employeeFire', formatApiDetail(e?.response?.data?.detail)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-on-surface-variant">
        Следующий номер приказа: <span className="font-medium text-on-surface">{seq?.fire_next_label || '—'}</span>
      </p>

      <div className="card-elevated space-y-4 p-6">
        <input className="input max-w-md" placeholder="Поиск по ФИО" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="text-xs text-on-surface-variant">Можно отметить до двух человек для одного приказа и ПУ-2.</p>
        <div className="overflow-x-auto rounded-xl border border-outline/60">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container-low text-left">
              <tr>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2">ФИО</th>
                <th className="px-3 py-2">Должность</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-outline/60">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2">{r.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-on-surface-variant">
            Дата увольнения
            <input className="input mt-1" type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
          </label>
          <label className="text-sm text-on-surface-variant md:col-span-2">
            Основание (ТК РБ)
            <select className="input mt-1" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {BELARUS_DISMISSAL_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Выполняется…' : 'Уволить и отправить ПУ-2'}
        </button>
      </div>
    </div>
  )
}
