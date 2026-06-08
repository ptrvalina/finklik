import { useEffect, useMemo, useState } from 'react'
import { employeesApi } from '../../api/client'
import { addLaborBookEntry, listLaborBookEntries, type LaborBookEntry } from '../../lib/hrStorage'

type Emp = {
  id: string
  full_name: string
  hire_date?: string
  fire_date?: string | null
  is_active: boolean
  hr_meta?: Record<string, unknown>
}

function toCsv(rows: Record<string, string>[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [keys.join(';'), ...rows.map((r) => keys.map((k) => esc(r[k] ?? '')).join(';'))].join('\n')
}

export default function LaborBook() {
  const [entries, setEntries] = useState<LaborBookEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const { data } = await employeesApi.list({ active_only: false })
      const emps = (data || []) as Emp[]

      for (const e of emps) {
        const meta = e.hr_meta || {}
        if (e.hire_date) {
          addLaborBookEntry({
            id: `hire-${e.id}`,
            employee_id: e.id,
            employee_name: e.full_name,
            event_type: 'hire',
            event_date: e.hire_date,
            order_number: String(meta.hire_order_number || '—'),
            order_date: String(meta.hire_order_date || e.hire_date),
            note: 'Приём на работу',
          })
        }
        if (e.fire_date) {
          addLaborBookEntry({
            id: `fire-${e.id}`,
            employee_id: e.id,
            employee_name: e.full_name,
            event_type: 'dismiss',
            event_date: e.fire_date,
            order_number: String(meta.fire_order_number || '—'),
            order_date: String(meta.fire_order_date || e.fire_date),
            note: String(meta.dismissal_reason_label || 'Увольнение'),
          })
        }
      }

      setEntries(listLaborBookEntries())
      setLoading(false)
    })()
  }, [])

  const rows = useMemo(
    () =>
      [...entries].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.employee_name.localeCompare(b.employee_name)),
    [entries],
  )

  function exportCsv() {
    const data = rows.map((r, i) => ({
      '№ п/п': String(i + 1),
      ФИО: r.employee_name,
      'Вид записи': r.event_type === 'hire' ? 'Приём' : r.event_type === 'dismiss' ? 'Увольнение' : 'Перевод',
      'Дата события': r.event_date,
      '№ приказа': r.order_number,
      'Дата приказа': r.order_date,
      Примечание: r.note || '',
    }))
    const blob = new Blob(['\uFEFF' + toCsv(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kniga_ucheta_trudovyh_knizhek.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant max-w-2xl">
          Книга учёта движения трудовых книжек — записи о приёме, переводе и увольнении с указанием основания (приказа).
        </p>
        <button type="button" className="btn-secondary text-sm" disabled={!rows.length} onClick={exportCsv}>
          Выгрузить CSV
        </button>
      </div>

      {loading ? (
        <div className="fc-skeleton-pulse min-h-[200px] rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Записей пока нет. Оформите приём сотрудника в разделе «Документы».</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline/60">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low text-left">
                <th className="px-3 py-2">№</th>
                <th className="px-3 py-2">ФИО</th>
                <th className="px-3 py-2">Вид записи</th>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">№ приказа</th>
                <th className="px-3 py-2">Дата приказа</th>
                <th className="px-3 py-2">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-outline/40">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-3 py-2">
                    {r.event_type === 'hire' ? 'Приём' : r.event_type === 'dismiss' ? 'Увольнение' : 'Перевод'}
                  </td>
                  <td className="px-3 py-2">{r.event_date}</td>
                  <td className="px-3 py-2">{r.order_number}</td>
                  <td className="px-3 py-2">{r.order_date}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
