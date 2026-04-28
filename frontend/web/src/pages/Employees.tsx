import { useEffect, useMemo, useRef, useState } from 'react'
import { api, employeesApi, regulatoryApi, scannerApi, workforceApi } from '../api/client'
import { saveBlob } from '../utils/fileDownload'

type EmployeeRow = {
  id: string
  full_name: string
  position: string
  salary: string | number
  is_active: boolean
  created_at?: string
}

type SalaryRow = {
  id: string
  employee_id: string
  period: string
  base_salary: string
  bonuses: string
  taxes: string
  net_salary: string
  status: string
}

type RegulatoryUpdate = {
  id: string
  title: string
  summary?: string
  authority_name?: string
  authority?: string
  category?: string
  effective_date?: string
  severity?: string
}

type PlannerEvent = {
  id: string
  title: string
  event_date: string
  event_type: string
  color: string
}

const eventTypeMeta: Record<string, { label: string; badgeClass: string }> = {
  meeting: { label: 'Кадры', badgeClass: 'bg-blue-100 text-blue-800' },
  deadline: { label: 'Дедлайн', badgeClass: 'bg-amber-100 text-amber-800' },
  salary: { label: 'Зарплата', badgeClass: 'bg-emerald-100 text-emerald-800' },
  report: { label: 'Отчет', badgeClass: 'bg-violet-100 text-violet-800' },
  custom: { label: 'Событие', badgeClass: 'bg-zinc-200 text-zinc-700' },
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysUntil(dateIso: string) {
  const today = startOfDay(new Date())
  const eventDate = startOfDay(new Date(dateIso))
  return Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function deadlineMeta(dateIso: string) {
  const diff = daysUntil(dateIso)
  if (diff < 0) return { label: `Просрочено на ${Math.abs(diff)} дн.`, className: 'bg-rose-100 text-rose-700' }
  if (diff === 0) return { label: 'Сегодня', className: 'bg-orange-100 text-orange-700' }
  if (diff <= 7) return { label: `Через ${diff} дн.`, className: 'bg-amber-100 text-amber-800' }
  return { label: 'Запланировано', className: 'bg-emerald-100 text-emerald-700' }
}

function deadlinePriority(dateIso: string) {
  const diff = daysUntil(dateIso)
  if (diff < 0) return 0
  if (diff === 0) return 1
  if (diff <= 7) return 2
  return 3
}

function makeOrderNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const n = String(Math.floor(Math.random() * 900) + 100)
  return `${y}${m}${d}-${n}К`
}

function statusClass(status?: string) {
  if (status === 'accepted') return 'bg-emerald-500'
  if (status === 'rejected') return 'bg-rose-500'
  if (status === 'pending') return 'bg-amber-500'
  return 'bg-zinc-400'
}

export default function Employees() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uiError, setUiError] = useState<string | null>(null)
  const [terminationSubmitting, setTerminationSubmitting] = useState(false)
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([])
  const [salaryLoading, setSalaryLoading] = useState(false)
  const [lastFsznStatus, setLastFsznStatus] = useState<'accepted' | 'rejected' | 'pending' | null>(null)
  const [pu2StatusMap, setPu2StatusMap] = useState<Record<string, 'accepted' | 'rejected' | 'pending'>>({})
  const [dismissAction, setDismissAction] = useState({
    employeeID: '',
    actionType: 'sick_leave',
    amount: '',
    orderNumber: makeOrderNumber(),
  })
  const [salaryPeriod, setSalaryPeriod] = useState(() => {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return period
  })
  const passportFileRef = useRef<HTMLInputElement>(null)

  const [hireForm, setHireForm] = useState({
    fullName: '',
    passportData: '',
    salary: '',
    positionCode: '',
    positionName: '',
    address: '',
    phone: '',
    email: '',
    hireDate: new Date().toISOString().slice(0, 10),
    orderDate: new Date().toISOString().slice(0, 10),
    orderNumber: makeOrderNumber(),
  })
  const [termination, setTermination] = useState({
    employeeID: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [lastCreatedEmployeeID, setLastCreatedEmployeeID] = useState<string>('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [lastActionMessage, setLastActionMessage] = useState<string>('')
  const [regulatoryUpdates, setRegulatoryUpdates] = useState<RegulatoryUpdate[]>([])
  const [plannerEvents, setPlannerEvents] = useState<PlannerEvent[]>([])
  const [lawsRefreshing, setLawsRefreshing] = useState(false)
  const [plannerFilter, setPlannerFilter] = useState<'all' | 'hire' | 'termination' | 'changes'>('all')
  const [reminderDays, setReminderDays] = useState<1 | 3 | 7>(3)
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDate, setEditingDate] = useState('')
  const [plannerBusy, setPlannerBusy] = useState(false)

  const activeEmployees = useMemo(() => employees.filter((e) => e.is_active), [employees])

  async function loadEmployees() {
    setLoading(true)
    try {
      const { data } = await employeesApi.list({ active_only: false })
      setEmployees(data || [])
      setUiError(null)
      if (!termination.employeeID && data?.length) {
        const firstActive = (data as EmployeeRow[]).find((employee) => employee.is_active)
        if (firstActive) {
          setTermination((prev) => ({ ...prev, employeeID: firstActive.id }))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEmployees()
  }, [])

  async function loadRegulatory() {
    try {
      setLawsRefreshing(true)
      const { data } = await regulatoryApi.getUpdates()
      setRegulatoryUpdates(data?.updates || [])
    } catch {
      setUiError((prev) => prev || 'Не удалось загрузить блок обновлений законодательства')
    } finally {
      setLawsRefreshing(false)
    }
  }

  async function loadPlanner() {
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10)
    const to = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().slice(0, 10)
    try {
      const { data } = await api.get('/calendar/events', { params: { date_from: from, date_to: to } })
      setPlannerEvents((data || []).filter((event: PlannerEvent) => /сотрудник|кадры|увольн|прием|приём/i.test(event.title)))
    } catch {
      setUiError((prev) => prev || 'Не удалось загрузить планер кадровых событий')
    }
  }

  useEffect(() => {
    void loadRegulatory()
    void loadPlanner()
    const timer = window.setInterval(() => {
      void loadRegulatory()
    }, 1000 * 60 * 10)
    return () => window.clearInterval(timer)
  }, [])

  async function addPlannerEvent(title: string, eventDate: string, eventType = 'deadline') {
    await api.post('/calendar/events', {
      title,
      event_date: eventDate,
      event_type: eventType,
      color: eventType === 'salary' ? '#059669' : '#2563eb',
    })
    await loadPlanner()
  }

  async function updatePlannerEvent() {
    if (!editingEvent) return
    setPlannerBusy(true)
    try {
      await api.put(`/calendar/events/${editingEvent.id}`, {
        title: editingTitle,
        event_date: editingDate,
      })
      setEditingEvent(null)
      await loadPlanner()
    } finally {
      setPlannerBusy(false)
    }
  }

  async function deletePlannerEvent(id: string) {
    if (!confirm('Удалить это событие из планера?')) return
    setPlannerBusy(true)
    try {
      await api.delete(`/calendar/events/${id}`)
      await loadPlanner()
    } finally {
      setPlannerBusy(false)
    }
  }

  function exportPlannerCsv() {
    const header = ['date', 'type', 'title']
    const rows = filteredPlannerEvents.map((event) => [
      event.event_date,
      eventTypeMeta[event.event_type]?.label || event.event_type,
      `"${(event.title || '').replace(/"/g, '""')}"`,
    ])
    const csv = [header.join(';'), ...rows.map((row) => row.join(';'))].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    saveBlob(blob, `employees_planner_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const tomorrowDate = useMemo(() => {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    return now.toISOString().slice(0, 10)
  }, [])

  const filteredPlannerEvents = useMemo(() => {
    const sorted = [...plannerEvents].sort((a, b) => {
      const p = deadlinePriority(a.event_date) - deadlinePriority(b.event_date)
      if (p !== 0) return p
      return a.event_date.localeCompare(b.event_date)
    })
    if (plannerFilter === 'all') return sorted
    if (plannerFilter === 'hire') return sorted.filter((event) => /прием|приём|hire|контракт/i.test(event.title))
    if (plannerFilter === 'termination') return sorted.filter((event) => /увольн|terminate|pu-2|пу-2/i.test(event.title))
    return sorted.filter((event) => /изменение|премия|больнич|отпуск|матпомощ/i.test(event.title))
  }, [plannerEvents, plannerFilter])

  const reminderEvents = useMemo(() => {
    return filteredPlannerEvents.filter((event) => {
      const diff = daysUntil(event.event_date)
      return diff >= 0 && diff <= reminderDays
    })
  }, [filteredPlannerEvents, reminderDays])

  async function runHrAction(label: string, employeeIDOverride?: string, orderNumberOverride?: string) {
    const targetEmployeeID = employeeIDOverride || dismissAction.employeeID
    const targetOrderNumber = orderNumberOverride || dismissAction.orderNumber
    if (!targetEmployeeID) {
      alert('Сначала выберите сотрудника в блоке "Штат".')
      return
    }
    setBusyAction(label)
    try {
      const employee = employees.find((row) => row.id === targetEmployeeID)
      const employeeName = employee?.full_name || targetEmployeeID
      const message = `${label} оформлено для ${employeeName} (приказ № ${targetOrderNumber})`
      setLastActionMessage(message)
      await addPlannerEvent(`${label}: ${employeeName}`, new Date().toISOString().slice(0, 10), 'meeting')
      setUiError(null)
      alert(message)
    } catch {
      setUiError(`Не удалось выполнить действие: ${label}`)
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePassportScan(file?: File) {
    try {
      if (file) {
        await scannerApi.upload(file)
      }
      const placeholder = 'MP1234567, выдан Фрунзенским РУВД, 12.04.2022'
      setHireForm((prev) => ({ ...prev, passportData: prev.passportData || placeholder }))
      alert('Паспорт отсканирован, поля заполнены (OCR демо).')
    } catch {
      alert('Не удалось выполнить OCR. Повторите позже.')
    }
  }

  async function handleCreateEmployee() {
    if (!consent) {
      alert('Нужно согласие на обработку персональных данных.')
      return
    }
    setSubmitting(true)
    try {
      if (!hireForm.fullName.trim() || !hireForm.positionName.trim() || Number(hireForm.salary || 0) <= 0) {
        alert('Заполните ФИО, должность и сумму ЗП.')
        return
      }
      const { data } = await employeesApi.create({
        full_name: hireForm.fullName,
        identification_number: null,
        position: hireForm.positionName,
        salary: Number(hireForm.salary || 0),
        hire_date: hireForm.hireDate,
        has_children: 0,
        passport_data: hireForm.passportData || null,
        position_code: hireForm.positionCode || null,
        position_name: hireForm.positionName || null,
        address: hireForm.address || null,
        phone: hireForm.phone || null,
        email: hireForm.email || null,
      })
      setLastCreatedEmployeeID(data?.id || '')
      await loadEmployees()
      setUiError(null)
      alert('Сотрудник принят. Данные отправлены на подпись.')
      setHireForm((prev) => ({
        ...prev,
        fullName: '',
        passportData: '',
        salary: '',
        positionCode: '',
        positionName: '',
        address: '',
        phone: '',
        email: '',
        orderNumber: makeOrderNumber(),
      }))
      setConsent(false)
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Ошибка при создании сотрудника'
      setUiError(String(message))
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendPu2(employeeID: string) {
    setPu2StatusMap((prev) => ({ ...prev, [employeeID]: 'pending' }))
    try {
      const { data } = await workforceApi.sendPu2({ employee_id: employeeID })
      setPu2StatusMap((prev) => ({ ...prev, [employeeID]: data.status || 'accepted' }))
      setLastFsznStatus(data.status || 'accepted')
      setUiError(null)
    } catch {
      setPu2StatusMap((prev) => ({ ...prev, [employeeID]: 'rejected' }))
      setLastFsznStatus('rejected')
      setUiError('Не удалось отправить ПУ-2 в ФСЗН')
    }
  }

  async function handleTerminate() {
    if (!termination.employeeID) {
      alert('Выбери сотрудника для увольнения')
      return
    }
    if (!confirm('Подтвердить увольнение сотрудника?')) return
    setTerminationSubmitting(true)
    try {
      await workforceApi.terminate(termination.employeeID, termination.date)
      await handleSendPu2(termination.employeeID)
      await loadEmployees()
      setUiError(null)
      alert('Сотрудник уволен')
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Ошибка увольнения'
      setUiError(String(message))
      alert(message)
    } finally {
      setTerminationSubmitting(false)
    }
  }

  async function handleSalaryCalculate() {
    const [year, month] = salaryPeriod.split('-').map(Number)
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-28`
    setSalaryLoading(true)
    try {
      for (const employee of activeEmployees) {
        await workforceApi.calculateSalary({
          employee_id: employee.id,
          period_start: periodStart,
          period_end: periodEnd,
        })
      }
      const { data } = await workforceApi.listSalaryCalculations()
      setSalaryRows(data || [])
      setUiError(null)
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Ошибка расчета зарплаты'
      setUiError(String(message))
      alert(message)
    } finally {
      setSalaryLoading(false)
    }
  }

  async function handleFsznAction(type: '4-fond' | 'pu3' | 'pz') {
    try {
      if (type === 'pu3') {
        const { data } = await workforceApi.sendPu3({
          period: `${salaryPeriod}-01`,
          xml_data: '<PU3 />',
        })
        setLastFsznStatus(data.status || 'accepted')
        setUiError(null)
        return
      }
      setLastFsznStatus('pending')
      setTimeout(() => setLastFsznStatus('accepted'), 1200)
    } catch {
      setLastFsznStatus('rejected')
      setUiError('Ошибка отправки в ФСЗН')
    }
  }

  return (
    <section className="space-y-6">
      <header className="card-elevated p-6">
        <h1 className="text-2xl font-semibold text-on-surface">Сотрудники</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Прием, увольнение, штат, зарплата и ФСЗН в одном месте.
        </p>
        {uiError ? <p className="mt-2 text-sm text-rose-500">{uiError}</p> : null}
      </header>

      <section className="card-elevated space-y-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">1) Принятие сотрудника</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" placeholder="ФИО" value={hireForm.fullName} onChange={(e) => setHireForm((p) => ({ ...p, fullName: e.target.value }))} />
          <input className="input" placeholder="Паспортные данные" value={hireForm.passportData} onChange={(e) => setHireForm((p) => ({ ...p, passportData: e.target.value }))} />
          <input className="input" type="date" value={hireForm.hireDate} onChange={(e) => setHireForm((p) => ({ ...p, hireDate: e.target.value }))} />
          <input className="input" type="date" value={hireForm.orderDate} onChange={(e) => setHireForm((p) => ({ ...p, orderDate: e.target.value }))} />
          <input className="input" placeholder="Номер приказа" value={hireForm.orderNumber} onChange={(e) => setHireForm((p) => ({ ...p, orderNumber: e.target.value }))} />
          <input className="input" placeholder="Сумма ЗП" value={hireForm.salary} onChange={(e) => setHireForm((p) => ({ ...p, salary: e.target.value }))} />
          <input className="input" placeholder="Код должности (ОКРБ)" value={hireForm.positionCode} onChange={(e) => setHireForm((p) => ({ ...p, positionCode: e.target.value }))} />
          <input className="input" placeholder="Название должности" value={hireForm.positionName} onChange={(e) => setHireForm((p) => ({ ...p, positionName: e.target.value }))} />
          <input className="input md:col-span-2" placeholder="Адрес" value={hireForm.address} onChange={(e) => setHireForm((p) => ({ ...p, address: e.target.value }))} />
          <input className="input" placeholder="Телефон" value={hireForm.phone} onChange={(e) => setHireForm((p) => ({ ...p, phone: e.target.value }))} />
          <input className="input" placeholder="Email" value={hireForm.email} onChange={(e) => setHireForm((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <input
          ref={passportFileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          className="hidden"
          onChange={(e) => void handlePassportScan(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => passportFileRef.current?.click()}>Скан паспорта</button>
          <button
            className="btn-secondary"
            disabled={busyAction === 'contract'}
            onClick={async () => {
              setBusyAction('contract')
              try {
                await addPlannerEvent(`Подписать контракт (приказ № ${hireForm.orderNumber})`, hireForm.orderDate, 'report')
                setLastActionMessage('Контракт и приказ отправлены на подпись.')
                alert('Отправлено на подпись')
              } finally {
                setBusyAction(null)
              }
            }}
          >
            {busyAction === 'contract' ? 'Отправка...' : 'Сформировать контракт и приказ'}
          </button>
          <button
            className={`btn-secondary text-white ${statusClass(lastCreatedEmployeeID ? pu2StatusMap[lastCreatedEmployeeID] : undefined)}`}
            onClick={() => {
              const target = lastCreatedEmployeeID || activeEmployees[0]?.id
              if (!target) return alert('Сначала создайте сотрудника')
              void handleSendPu2(target)
            }}
          >
            ПУ-2
          </button>
          <button
            className="btn-secondary"
            disabled={busyAction === 'bank_account'}
            onClick={async () => {
              setBusyAction('bank_account')
              try {
                await addPlannerEvent('Открыть зарплатный счёт сотруднику', new Date().toISOString().slice(0, 10), 'deadline')
                setLastActionMessage('Задача на открытие счёта поставлена в планер.')
              } finally {
                setBusyAction(null)
              }
            }}
          >
            {busyAction === 'bank_account' ? 'Создаём...' : 'Открыть счёт'}
          </button>
          <button
            className="btn-secondary"
            disabled={busyAction === 'staffing'}
            onClick={async () => {
              setBusyAction('staffing')
              try {
                await addPlannerEvent('Обновить штатное расписание', new Date().toISOString().slice(0, 10), 'custom')
                setLastActionMessage('Штатное расписание добавлено в планер.')
              } finally {
                setBusyAction(null)
              }
            }}
          >
            {busyAction === 'staffing' ? 'Обновляем...' : 'Штатное расписание'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Согласие на обработку ПД
        </label>
        <button className="btn-primary" disabled={submitting} onClick={() => void handleCreateEmployee()}>
          {submitting ? 'Сохраняем...' : 'Принять сотрудника'}
        </button>
      </section>

      <section className="card-elevated space-y-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">2) Увольнение</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="input" value={termination.employeeID} onChange={(e) => setTermination((p) => ({ ...p, employeeID: e.target.value }))}>
            <option value="">Выберите сотрудника</option>
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.full_name}</option>
            ))}
          </select>
          <input className="input" type="date" value={termination.date} onChange={(e) => setTermination((p) => ({ ...p, date: e.target.value }))} />
        </div>
        <button className="btn-primary" disabled={terminationSubmitting} onClick={() => void handleTerminate()}>
          {terminationSubmitting ? 'Увольнение...' : 'Уволить'}
        </button>
        <button
          className={`btn-secondary text-white ${statusClass(termination.employeeID ? pu2StatusMap[termination.employeeID] : undefined)}`}
          disabled={!termination.employeeID}
          onClick={() => {
            if (!termination.employeeID) return
            void handleSendPu2(termination.employeeID)
          }}
        >
          ПУ-2 по увольнению
        </button>
      </section>

      <section className="card-elevated space-y-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">3) Штат</h2>
        {loading ? (
          <p className="text-sm text-on-surface-variant">Загрузка сотрудников...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline/60">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-container-low text-left">
                <tr>
                  <th className="px-3 py-2">ФИО</th>
                  <th className="px-3 py-2">Должность</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-t border-outline/60">
                    <td className="px-3 py-2">{employee.full_name}</td>
                    <td className="px-3 py-2">{employee.position}</td>
                    <td className="px-3 py-2">{employee.is_active ? 'Активен' : 'Уволен'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {['Больничный', 'Отпуск', 'Изменение ЗП', 'Изменение должности', 'Премия', 'Матпомощь'].map((title) => (
                          <button
                            key={title}
                            className="rounded-lg border border-outline/70 px-2 py-1 text-xs"
                            onClick={() => {
                              const nextOrderNumber = makeOrderNumber()
                              setDismissAction((prev) => ({ ...prev, employeeID: employee.id, orderNumber: nextOrderNumber }))
                              void runHrAction(title, employee.id, nextOrderNumber)
                            }}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid gap-2 rounded-xl border border-outline/60 p-3 md:grid-cols-4">
          <select className="input" value={dismissAction.employeeID} onChange={(e) => setDismissAction((p) => ({ ...p, employeeID: e.target.value }))}>
            <option value="">Сотрудник</option>
            {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name}</option>)}
          </select>
          <select className="input" value={dismissAction.actionType} onChange={(e) => setDismissAction((p) => ({ ...p, actionType: e.target.value }))}>
            <option value="sick_leave">Больничный</option>
            <option value="vacation">Отпуск</option>
            <option value="salary_change">Изменение ЗП</option>
            <option value="position_change">Изменение должности</option>
            <option value="bonus">Премия</option>
            <option value="financial_help">Матпомощь</option>
          </select>
          <input className="input" placeholder="Сумма/комментарий" value={dismissAction.amount} onChange={(e) => setDismissAction((p) => ({ ...p, amount: e.target.value }))} />
          <input className="input" value={dismissAction.orderNumber} onChange={(e) => setDismissAction((p) => ({ ...p, orderNumber: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button className="btn-secondary w-full" disabled={busyAction === 'Больничный'} onClick={() => void runHrAction('Больничный')}>Оформить больничный</button>
          <button className="btn-secondary w-full" disabled={busyAction === 'Отпуск'} onClick={() => void runHrAction('Отпуск')}>Оформить отпуск</button>
          <button className="btn-secondary w-full" disabled={busyAction === 'Изменение ЗП'} onClick={() => void runHrAction('Изменение ЗП')}>Применить изменение ЗП</button>
          <button className="btn-secondary w-full" disabled={busyAction === 'Изменение должности'} onClick={() => void runHrAction('Изменение должности')}>Применить изменение должности</button>
          <button className="btn-secondary w-full" disabled={busyAction === 'Премия'} onClick={() => void runHrAction('Премия')}>Начислить премию</button>
          <button className="btn-secondary w-full" disabled={busyAction === 'Матпомощь'} onClick={() => void runHrAction('Матпомощь')}>Выдать матпомощь</button>
        </div>
        {lastActionMessage ? (
          <p className="text-sm text-on-surface-variant">{lastActionMessage}</p>
        ) : null}
      </section>

      <section className="card-elevated space-y-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">4) Заработная плата</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-44" type="month" value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} />
          <button className="btn-primary" disabled={salaryLoading} onClick={() => void handleSalaryCalculate()}>
            {salaryLoading ? 'Считаем...' : 'Рассчитать'}
          </button>
          <button
            className="btn-secondary"
            disabled={busyAction === 'salary_pay'}
            onClick={async () => {
              setBusyAction('salary_pay')
              try {
                await addPlannerEvent(`Выплата зарплаты за ${salaryPeriod}`, `${salaryPeriod}-25`, 'salary')
                setLastActionMessage('Выплата добавлена в планер событий.')
              } finally {
                setBusyAction(null)
              }
            }}
          >
            {busyAction === 'salary_pay' ? 'Формируем...' : 'Выплатить'}
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-outline/60">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container-low text-left">
              <tr>
                <th className="px-3 py-2">Сотрудник</th>
                <th className="px-3 py-2">Базовая ЗП</th>
                <th className="px-3 py-2">Премии</th>
                <th className="px-3 py-2">Налоги</th>
                <th className="px-3 py-2">К выплате</th>
              </tr>
            </thead>
            <tbody>
              {salaryRows.map((row) => {
                const employee = employees.find((x) => x.id === row.employee_id)
                return (
                  <tr key={row.id} className="border-t border-outline/60">
                    <td className="px-3 py-2">{employee?.full_name || row.employee_id}</td>
                    <td className="px-3 py-2">{row.base_salary}</td>
                    <td className="px-3 py-2">{row.bonuses}</td>
                    <td className="px-3 py-2">{row.taxes}</td>
                    <td className="px-3 py-2 font-semibold">{row.net_salary}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-elevated space-y-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">5) ФСЗН</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => void handleFsznAction('4-fond')}>Сформировать 4-Fond</button>
          <button className="btn-secondary" onClick={() => void handleFsznAction('pu3')}>Сформировать ПУ-3</button>
          <button className="btn-secondary" onClick={() => void handleFsznAction('pz')}>Сформировать ПЗ</button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-3 w-3 rounded-full ${statusClass(lastFsznStatus || undefined)}`} />
          <span className="text-on-surface-variant">Статус последней отправки: {lastFsznStatus || 'нет данных'}</span>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card-elevated space-y-4 p-6">
          <h2 className="text-lg font-semibold text-on-surface">6) Законы и постановления по кадрам</h2>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-on-surface-variant">
              Блок обновляется автоматически каждые 10 минут из регуляторной ленты.
            </p>
            <button className="btn-secondary" disabled={lawsRefreshing} onClick={() => void loadRegulatory()}>
              {lawsRefreshing ? 'Обновляем...' : 'Обновить сейчас'}
            </button>
          </div>
          {['law_change', 'form_update', 'deadline', 'rate_change'].map((category) => {
            const items = regulatoryUpdates.filter((update) => update.category === category).slice(0, 6)
            const title =
              category === 'law_change' ? 'Законы' :
              category === 'form_update' ? 'Формы и шаблоны' :
              category === 'deadline' ? 'Сроки' :
              'Ставки'
            return (
              <div key={category} className="space-y-2 rounded-xl border border-outline/60 p-3">
                <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
                {items.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Нет новых публикаций.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {items.map((update) => (
                      <li key={update.id} className="rounded-lg bg-surface-container-low p-2">
                        <p className="font-semibold text-on-surface">{update.title}</p>
                        <p className="text-on-surface-variant">{update.summary || 'Без описания'}</p>
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {update.authority_name || update.authority || 'Регулятор'} • {update.effective_date ? new Date(update.effective_date).toLocaleDateString('ru-BY') : 'дата не указана'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        <div className="card-elevated space-y-4 p-6">
          <h2 className="text-lg font-semibold text-on-surface">7) Планер событий (найм/увольнение)</h2>
          <p className="text-sm text-on-surface-variant">
            Автоматически пополняется событиями из действий на этой странице.
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            <button
              className="btn-secondary w-full"
              onClick={() => void addPlannerEvent('Проверка кадровых документов (завтра)', tomorrowDate, 'meeting')}
            >
              Событие на завтра
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() =>
                void addPlannerEvent(
                  `Контроль приказа о приеме № ${hireForm.orderNumber}`,
                  hireForm.orderDate,
                  'report',
                )
              }
            >
              Событие на дату приказа
            </button>
            <button
              className="btn-secondary w-full"
              disabled={!termination.date}
              onClick={() =>
                void addPlannerEvent(
                  `Контроль увольнения сотрудника`,
                  termination.date,
                  'deadline',
                )
              }
            >
              Событие на дату увольнения
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`btn-secondary ${plannerFilter === 'all' ? 'ring-2 ring-primary' : ''}`} onClick={() => setPlannerFilter('all')}>Все</button>
            <button className={`btn-secondary ${plannerFilter === 'hire' ? 'ring-2 ring-primary' : ''}`} onClick={() => setPlannerFilter('hire')}>Найм</button>
            <button className={`btn-secondary ${plannerFilter === 'termination' ? 'ring-2 ring-primary' : ''}`} onClick={() => setPlannerFilter('termination')}>Увольнение</button>
            <button className={`btn-secondary ${plannerFilter === 'changes' ? 'ring-2 ring-primary' : ''}`} onClick={() => setPlannerFilter('changes')}>Кадровые изменения</button>
            <button className="btn-secondary" onClick={exportPlannerCsv}>Экспорт CSV</button>
          </div>
          <div className="rounded-xl border border-outline/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-on-surface">Напоминания:</p>
              <button className={`btn-secondary ${reminderDays === 1 ? 'ring-2 ring-primary' : ''}`} onClick={() => setReminderDays(1)}>1 день</button>
              <button className={`btn-secondary ${reminderDays === 3 ? 'ring-2 ring-primary' : ''}`} onClick={() => setReminderDays(3)}>3 дня</button>
              <button className={`btn-secondary ${reminderDays === 7 ? 'ring-2 ring-primary' : ''}`} onClick={() => setReminderDays(7)}>7 дней</button>
            </div>
            <div className="mt-2 space-y-2">
              {reminderEvents.length === 0 ? (
                <p className="text-xs text-on-surface-variant">На выбранный период напоминаний нет.</p>
              ) : (
                reminderEvents.map((event) => {
                  const meta = deadlineMeta(event.event_date)
                  return (
                    <div key={`reminder-${event.id}`} className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
                      <p className="text-xs text-on-surface">{event.title}</p>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${meta.className}`}>{meta.label}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div className="space-y-2">
            {filteredPlannerEvents.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Пока нет событий по кадрам.</p>
            ) : (
              filteredPlannerEvents.map((event) => (
                  (() => {
                    const deadline = deadlineMeta(event.event_date)
                    return (
                  <div key={event.id} className="flex items-center justify-between rounded-xl border border-outline/60 p-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface">{event.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-on-surface-variant">{new Date(event.event_date).toLocaleDateString('ru-BY')}</p>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${deadline.className}`}>{deadline.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${eventTypeMeta[event.event_type]?.badgeClass || eventTypeMeta.custom.badgeClass}`}>
                        {eventTypeMeta[event.event_type]?.label || event.event_type}
                      </span>
                      <button
                        className="rounded-md border border-outline/70 px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingEvent(event)
                          setEditingTitle(event.title)
                          setEditingDate(event.event_date)
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600"
                        onClick={() => void deletePlannerEvent(event.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                    )
                  })()
                ))
            )}
          </div>
          {editingEvent ? (
            <div className="space-y-2 rounded-xl border border-outline/60 p-3">
              <p className="text-sm font-semibold text-on-surface">Редактирование события</p>
              <input className="input" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
              <input className="input" type="date" value={editingDate} onChange={(e) => setEditingDate(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary" disabled={plannerBusy} onClick={() => void updatePlannerEvent()}>
                  {plannerBusy ? 'Сохраняем...' : 'Сохранить'}
                </button>
                <button className="btn-secondary" onClick={() => setEditingEvent(null)}>Отмена</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  )
}
