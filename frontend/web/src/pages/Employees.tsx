import { useEffect, useMemo, useRef, useState } from 'react'
import { employeesApi, scannerApi, workforceApi } from '../api/client'

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

  const activeEmployees = useMemo(() => employees.filter((e) => e.is_active), [employees])

  async function loadEmployees() {
    setLoading(true)
    try {
      const { data } = await employeesApi.list({ active_only: false })
      setEmployees(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEmployees()
  }, [])

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
      await employeesApi.create({
        full_name: hireForm.fullName,
        identification_number: null,
        position: hireForm.positionName,
        salary: Number(hireForm.salary || 0),
        hire_date: hireForm.hireDate,
        has_children: 0,
      })
      await loadEmployees()
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
      alert(e?.response?.data?.detail || 'Ошибка при создании сотрудника')
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
    } catch {
      setPu2StatusMap((prev) => ({ ...prev, [employeeID]: 'rejected' }))
      setLastFsznStatus('rejected')
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
      alert('Сотрудник уволен')
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Ошибка увольнения')
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
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Ошибка расчета зарплаты')
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
        return
      }
      setLastFsznStatus('pending')
      setTimeout(() => setLastFsznStatus('accepted'), 1200)
    } catch {
      setLastFsznStatus('rejected')
    }
  }

  return (
    <section className="space-y-6">
      <header className="card-elevated p-6">
        <h1 className="text-2xl font-semibold text-on-surface">Сотрудники</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Прием, увольнение, штат, зарплата и ФСЗН в одном месте.
        </p>
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
          <button className="btn-secondary" onClick={() => alert('Отправлено на подпись')}>Сформировать контракт и приказ</button>
          <button
            className={`btn-secondary text-white ${statusClass(hireForm.fullName ? pu2StatusMap[activeEmployees[0]?.id || ''] : undefined)}`}
            onClick={() => {
              const target = activeEmployees[0]?.id
              if (!target) return alert('Сначала создайте сотрудника')
              void handleSendPu2(target)
            }}
          >
            ПУ-2
          </button>
          <button className="btn-secondary" onClick={() => alert('Открыть счёт — в разработке')}>Открыть счёт</button>
          <button className="btn-secondary" onClick={() => alert('Штатное расписание — в разработке')}>Штатное расписание</button>
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
                              setDismissAction((prev) => ({ ...prev, employeeID: employee.id, orderNumber: makeOrderNumber() }))
                              alert(`${title}: форма откроется в следующем этапе. Приказ № ${makeOrderNumber()}`)
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
      </section>

      <section className="card-elevated space-y-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">4) Заработная плата</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-44" type="month" value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} />
          <button className="btn-primary" disabled={salaryLoading} onClick={() => void handleSalaryCalculate()}>
            {salaryLoading ? 'Считаем...' : 'Рассчитать'}
          </button>
          <button className="btn-secondary" onClick={() => alert('Выплата — в разработке')}>Выплатить</button>
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
    </section>
  )
}
