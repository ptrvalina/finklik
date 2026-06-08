import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeesApi } from '../../api/client'
import { mergeLeaveOrdersIntoTimesheet } from '../../lib/hrStorage'
import { MONTH_NAMES, TIMESHEET_CODES } from './timesheetCodes'

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function TimesheetLegend() {
  const primary = TIMESHEET_CODES.filter((c) => ['Я', 'В', 'О', 'С', 'Б', 'Н'].includes(c.code))
  const other = TIMESHEET_CODES.filter((c) => !primary.includes(c))

  return (
    <section className="rounded-xl border border-outline/40 bg-surface-container-lowest/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Обозначения в табеле</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            В ячейках — буквенный код дня. Коды <strong>О</strong> и <strong>С</strong> подставляются из{' '}
            <Link to="/employees/documents" className="font-semibold text-primary hover:underline">
              кадровых приказов
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {primary.map(({ code, label, auto }) => (
          <span
            key={code}
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
              auto
                ? 'border-primary/30 bg-primary/8 text-on-surface'
                : 'border-outline/35 bg-surface text-on-surface'
            }`}
            title={auto ? 'Заполняется автоматически из приказа об отпуске' : undefined}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-bold ${
                auto ? 'bg-primary text-primary-on' : 'bg-surface-container-high text-on-surface'
              }`}
            >
              {code}
            </span>
            <span className="leading-tight">
              {label}
              {auto ? <span className="mt-0.5 block text-[10px] font-medium text-primary">из приказа</span> : null}
            </span>
          </span>
        ))}
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs font-semibold text-on-surface-variant hover:text-primary">
          Остальные коды ({other.length})
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {other.map(({ code, label }) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-md border border-outline/30 bg-surface px-2 py-1 text-[11px] text-on-surface-variant"
            >
              <span className="font-bold text-on-surface">{code}</span>
              {label}
            </span>
          ))}
        </div>
      </details>
    </section>
  )
}

export default function EmployeesTimesheet() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [cells, setCells] = useState<Record<string, Record<number, string>>>({})

  const storageKey = `hr_timesheet_${year}_${month}`

  useEffect(() => {
    void employeesApi.list({ active_only: true }).then(({ data }) => {
      setEmployees((data || []).map((e: { id: string; full_name: string }) => ({ id: e.id, full_name: e.full_name })))
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold text-on-surface">Табель учёта рабочего времени</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Листок учёта за выбранный месяц</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-on-surface-variant">Год</span>
            <input
              className="input w-24"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-on-surface-variant">Месяц</span>
            <select className="input min-w-[9rem]" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <TimesheetLegend />

      <div className="overflow-x-auto rounded-xl border border-outline/60">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-surface-container-low">
              <th className="sticky left-0 z-10 bg-surface-container-low px-2 py-2 text-left">Сотрудник</th>
              {dayNums.map((d) => (
                <th key={d} className="px-1 py-2 text-center font-normal tabular-nums">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={dim + 1} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                  Нет активных сотрудников
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id} className="border-t border-outline/60">
                  <td className="sticky left-0 z-10 bg-surface px-2 py-1 whitespace-nowrap max-w-[180px] truncate">
                    {e.full_name}
                  </td>
                  {dayNums.map((d) => (
                    <td key={d} className="p-0">
                      <input
                        className="w-10 border-0 bg-transparent p-1 text-center uppercase focus:ring-1 focus:ring-primary/40"
                        value={cells[e.id]?.[d] || ''}
                        onChange={(ev) => setCell(e.id, d, ev.target.value.toUpperCase())}
                        maxLength={4}
                        aria-label={`${e.full_name}, день ${d}`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
