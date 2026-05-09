import { useEffect, useState } from 'react'
import { saveBlob } from '../../utils/fileDownload'

type Row = {
  id: string
  subdivision: string
  title: string
  units: number
  tariff_salary: string
  salary: string
  bonus_pct: string
  bonus_amt: string
  hardship: string
  internal_combo: string
  note: string
}

const LS = 'hr_staffing_rows_v1'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function EmployeesStaffing() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS)
      if (raw) setRows(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  function persist(next: Row[]) {
    setRows(next)
    localStorage.setItem(LS, JSON.stringify(next))
  }

  function addRow() {
    persist([
      ...rows,
      {
        id: uid(),
        subdivision: '',
        title: '',
        units: 1,
        tariff_salary: '',
        salary: '',
        bonus_pct: '',
        bonus_amt: '',
        hardship: '',
        internal_combo: '',
        note: '',
      },
    ])
  }

  function monthlyTotal(r: Row) {
    const base = Number(r.salary || 0) || 0
    const bonusPct = Number(r.bonus_pct || 0) || 0
    const bonusAmt = Number(r.bonus_amt || 0) || 0
    const hardship = Number(r.hardship || 0) || 0
    const combo = Number(r.internal_combo || 0) || 0
    return base + (base * bonusPct) / 100 + bonusAmt + hardship + combo
  }

  function exportCsv() {
    const header = [
      'Подразделение',
      'Должность',
      'Штатные единицы',
      'Тарифный оклад',
      'Оклад',
      'Стимулирование %',
      'Стимулирование сумма',
      'Надбавки',
      'Внутреннее совмещение',
      'Всего в месяц',
      'Примечание',
    ]
    const lines = rows.map((r) =>
      [
        r.subdivision,
        r.title,
        r.units,
        r.tariff_salary,
        r.salary,
        r.bonus_pct,
        r.bonus_amt,
        r.hardship,
        r.internal_combo,
        monthlyTotal(r).toFixed(2),
        r.note,
      ].join(';'),
    )
    const csv = [header.join(';'), ...lines].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    saveBlob(blob, `staffing_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={addRow}>
          Добавить строку
        </button>
        <button type="button" className="btn-secondary" onClick={exportCsv}>
          Экспорт CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-outline/60">
        <table className="min-w-[1100px] w-full text-xs">
          <thead className="bg-surface-container-low text-left">
            <tr>
              <th className="px-2 py-2">Подразделение</th>
              <th className="px-2 py-2">Должность</th>
              <th className="px-2 py-2">Шт. ед.</th>
              <th className="px-2 py-2">Тарифный оклад</th>
              <th className="px-2 py-2">Оклад</th>
              <th className="px-2 py-2">Стимул. %</th>
              <th className="px-2 py-2">Стимул. сумма</th>
              <th className="px-2 py-2">Надбавки</th>
              <th className="px-2 py-2">Совмещение</th>
              <th className="px-2 py-2">Всего / мес</th>
              <th className="px-2 py-2">Примечание</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} className="border-t border-outline/60">
                <td className="px-1 py-1">
                  <input className="input w-36 text-xs" value={r.subdivision} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, subdivision: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-40 text-xs" value={r.title} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="input w-14 text-xs"
                    type="number"
                    min={0}
                    value={r.units}
                    onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, units: Number(e.target.value) } : x)))}
                  />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-24 text-xs" value={r.tariff_salary} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, tariff_salary: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-24 text-xs" value={r.salary} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, salary: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-16 text-xs" value={r.bonus_pct} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, bonus_pct: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-20 text-xs" value={r.bonus_amt} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, bonus_amt: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-20 text-xs" value={r.hardship} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, hardship: e.target.value } : x)))} />
                </td>
                <td className="px-1 py-1">
                  <input className="input w-20 text-xs" value={r.internal_combo} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, internal_combo: e.target.value } : x)))} />
                </td>
                <td className="px-2 py-2 font-medium">{monthlyTotal(r).toFixed(2)}</td>
                <td className="px-1 py-1">
                  <input className="input w-32 text-xs" value={r.note} onChange={(e) => persist(rows.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
