import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeesApi } from '../../api/client'
import { mergeLeaveOrdersIntoTimesheet } from '../../lib/hrStorage'

const KEYS = 'ЯРВБОНПРДКУОТСХОЧ'

/** Упрощённый табель: заполняйте фактические часы/коды по дням (локально в браузере). Уточняйте учёт с учётом Закона РБ о занятости и Листка учёта времени. */

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export default function EmployeesTimesheet() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  /** empId -> day -> code */
  const [cells, setCells] = useState<Record<string, Record<number, string>>>({})

  const storageKey = `hr_timesheet_${year}_${month}`

  useEffect(() => {
    void employeesApi.list({ active_only: true }).then(({ data }) => {
      setEmployees((data || []).map((e: any) => ({ id: e.id, full_name: e.full_name })))
    })
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const base = raw ? (JSON.parse(raw) as Record<string, Record<number, string>>) : {}
      setCells(mergeLeaveOrdersIntoTimesheet(year, month, base))
    } catch {
      setCells(mergeLeaveOrdersIntoTimesheet(year, month, {}))
    }
  }, [storageKey, year, month])

  function persist(next: Record<string, Record<number, string>>) {
    setCells(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const dim = useMemo(() => daysInMonth(year, month), [year, month])
  const dayNums = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim])

  function setCell(empId: string, day: number, v: string) {
    persist({
      ...cells,
      [empId]: { ...(cells[empId] || {}), [day]: v.slice(0, 4) },
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        {KEYS.split('').join(' — коды в ячейках. О — трудовой отпуск, С — социальный (из ')}
        <Link to="/employees/documents" className="text-primary hover:underline">
          кадровых приказов
        </Link>
        ).
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm">
          Год
          <input className="input ml-2 w-28" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          Месяц
          <input className="input ml-2 w-20" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline/60">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-surface-container-low">
              <th className="sticky left-0 z-10 bg-surface-container-low px-2 py-2 text-left">Сотрудник</th>
              {dayNums.map((d) => (
                <th key={d} className="px-1 py-2 text-center font-normal">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-outline/60">
                <td className="sticky left-0 z-10 bg-surface px-2 py-1 whitespace-nowrap max-w-[180px] truncate">{e.full_name}</td>
                {dayNums.map((d) => (
                  <td key={d} className="p-0">
                    <input
                      className="w-10 border-0 bg-transparent p-1 text-center focus:ring-1"
                      value={cells[e.id]?.[d] || ''}
                      onChange={(ev) => setCell(e.id, d, ev.target.value)}
                      maxLength={4}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
