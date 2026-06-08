import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeesApi } from '../../api/client'
import {
  applyLeaveToTimesheet,
  buildLeaveOrderText,
  downloadTextFile,
  leaveOrderLabel,
  listLeaveOrders,
  nextLeaveOrderNumber,
  saveLeaveOrder,
  type HrLeaveOrder,
  type HrLeaveOrderType,
} from '../../lib/hrStorage'

type Emp = { id: string; full_name: string }

const SOCIAL_REASONS = [
  'Беременность и роды',
  'Уход за ребёнком до 3 лет',
  'Уход за ребёнком-инвалидом',
  'По уходу за больным членом семьи',
  'Другие случаи социального отпуска (ТК РБ)',
]

export default function HrDocuments() {
  const [employees, setEmployees] = useState<Emp[]>([])
  const [orders, setOrders] = useState<HrLeaveOrder[]>([])
  const [type, setType] = useState<HrLeaveOrderType>('labor')
  const [employeeId, setEmployeeId] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [socialReason, setSocialReason] = useState(SOCIAL_REASONS[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void employeesApi.list({ active_only: true }).then(({ data }) => {
      const list = (data || []).map((e: Emp) => ({ id: e.id, full_name: e.full_name }))
      setEmployees(list)
      if (list[0]) setEmployeeId(list[0].id)
    })
    setOrders(listLeaveOrders())
  }, [])

  const selectedName = employees.find((e) => e.id === employeeId)?.full_name ?? ''

  async function createLeaveOrder() {
    if (!employeeId || !dateFrom || !dateTo) {
      alert('Укажите сотрудника и период отпуска')
      return
    }
    if (dateFrom > dateTo) {
      alert('Дата начала не может быть позже даты окончания')
      return
    }
    setBusy(true)
    try {
      const order: HrLeaveOrder = {
        id: crypto.randomUUID(),
        type,
        employee_id: employeeId,
        employee_name: selectedName,
        order_number: nextLeaveOrderNumber(),
        order_date: orderDate,
        date_from: dateFrom,
        date_to: dateTo,
        social_reason: type === 'social' ? socialReason : undefined,
        created_at: new Date().toISOString(),
      }
      saveLeaveOrder(order)
      applyLeaveToTimesheet(order)
      setOrders(listLeaveOrders())
      const text = buildLeaveOrderText(order)
      downloadTextFile(
        `prikaz_${type === 'labor' ? 'trudovoy_otpusk' : 'socialnyy_otpusk'}_${order.order_number}.txt`,
        text,
      )
      alert('Приказ создан. Код отпуска проставлен в табеле за выбранный период.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-on-surface-variant">
        Кадровые приказы с выгрузкой. Приказы об отпуске автоматически заполняют табель учёта рабочего времени.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/employees/hire" className="glass-card rounded-2xl p-4 transition hover:border-primary/40">
          <p className="font-semibold text-on-surface">Приказ о приёме на работу</p>
          <p className="mt-1 text-sm text-on-surface-variant">Приём, анкета, выгрузка DOCX</p>
        </Link>
        <Link to="/employees/dismiss" className="glass-card rounded-2xl p-4 transition hover:border-primary/40">
          <p className="font-semibold text-on-surface">Приказ об увольнении</p>
          <p className="mt-1 text-sm text-on-surface-variant">Прекращение трудового договора по ТК РБ</p>
        </Link>
      </div>

      <section className="glass-card space-y-4 rounded-2xl p-5">
        <h2 className="font-headline text-lg font-bold">Отпуска</h2>

        <div className="flex flex-wrap gap-2">
          {(['labor', 'social'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                type === t ? 'bg-primary text-primary-on' : 'bg-surface-container-high text-on-surface'
              }`}
              onClick={() => setType(t)}
            >
              {leaveOrderLabel(t)}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Сотрудник
            <select className="input mt-1 w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Дата приказа
            <input className="input mt-1 w-full" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </label>
          <label className="text-sm">
            Отпуск с
            <input className="input mt-1 w-full" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            Отпуск по
            <input className="input mt-1 w-full" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>

        {type === 'social' && (
          <label className="block text-sm">
            Основание социального отпуска
            <select className="input mt-1 w-full" value={socialReason} onChange={(e) => setSocialReason(e.target.value)}>
              {SOCIAL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="text-xs text-on-surface-variant">
          В табеле: трудовой отпуск — код <strong>О</strong>, социальный — код <strong>С</strong>.
        </p>

        <button type="button" className="btn-primary" disabled={busy} onClick={() => void createLeaveOrder()}>
          {busy ? 'Создаём…' : 'Сформировать приказ и обновить табель'}
        </button>
      </section>

      {orders.length > 0 && (
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-headline text-lg font-bold">Созданные приказы об отпуске</h2>
          <ul className="mt-3 divide-y divide-outline/20">
            {orders.slice(0, 10).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {leaveOrderLabel(o.type)} № {o.order_number} — {o.employee_name}
                </span>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => downloadTextFile(`prikaz_${o.id}.txt`, buildLeaveOrderText(o))}
                >
                  Скачать
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
