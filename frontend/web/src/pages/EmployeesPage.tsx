import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '../api/client'
import AppModal from '../components/ui/AppModal'

function fmt(n: any) { return Number(n || 0).toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
}

const MONTHS = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

type IdDocType = '' | 'passport' | 'residence_permit' | 'refugee_certificate' | 'other'

type IdentityDocument = {
  series?: string | null
  number: string
  issued_by: string
  issued_date: string
  expiry_date?: string | null
}

type Employee = {
  id: string
  full_name: string
  identification_number?: string | null
  position: string
  salary: number
  hire_date: string
  fire_date: string | null
  is_active: boolean
  has_children: number
  disability_group?: number | null
  is_pensioner?: boolean
  citizenship?: string | null
  work_hours_per_day?: number | string | null
  work_hours_per_week?: number | string | null
  id_document_type?: string | null
  id_document?: IdentityDocument | null
}
type SalaryRecord = { id: string; employee_id: string; period_year: number; period_month: number; base_salary: number; bonus: number; sick_pay: number; vacation_pay: number; gross_salary: number; income_tax: number; fsszn_employee: number; net_salary: number; fsszn_employer: number; status: string }
type Tab = 'active' | 'fired' | 'payroll'

export default function EmployeesPage() {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [tab, setTab] = useState<Tab>('active')
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [salaryResult, setSalaryResult] = useState<SalaryRecord | null>(null)
  const [showFireConfirm, setShowFireConfirm] = useState<string | null>(null)
  const [fireDate, setFireDate] = useState(today)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [query, setQuery] = useState('')
  const [onlyWithChildren, setOnlyWithChildren] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear())
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1)
  const [form, setForm] = useState({
    full_name: '',
    identification_number: '',
    position: '',
    salary: '',
    hire_date: today,
    has_children: 0,
    disability_group: '' as '' | '1' | '2' | '3',
    is_pensioner: false,
    citizenship: '',
    work_hours_per_day: '',
    work_hours_per_week: '',
    id_document_type: '' as IdDocType,
    id_doc_series: '',
    id_doc_number: '',
    id_doc_issued_by: '',
    id_doc_issued_date: '',
    id_doc_expiry_date: '',
  })
  const [salaryForm, setSalaryForm] = useState({ period_year: new Date().getFullYear(), period_month: new Date().getMonth() + 1, bonus: 0, sick_days: 0, vacation_days: 0, work_days_plan: 21 })

  const activeOnly = tab === 'active'
  const { data, isLoading, isError } = useQuery({ queryKey: ['employees', activeOnly], queryFn: () => employeesApi.list({ active_only: activeOnly }).then(r => r.data) })
  const { data: payrollData, isLoading: payrollLoading } = useQuery({ queryKey: ['payroll', payrollYear, payrollMonth], queryFn: () => employeesApi.listSalary({ year: payrollYear, month: payrollMonth }).then(r => r.data), enabled: tab === 'payroll' })

  const createMutation = useMutation({
    mutationFn: (payload: any) => employeesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      closeModal()
      flash('success', 'Сотрудник добавлен')
    },
    onError: () => flash('error', 'Ошибка'),
  })
  const updateMutation = useMutation({ mutationFn: (d: { id: string; body: any }) => employeesApi.update(d.id, d.body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); closeModal(); flash('success', 'Обновлено') }, onError: () => flash('error', 'Ошибка') })
  const fireMutation = useMutation({ mutationFn: (d: { id: string; fire_date: string }) => employeesApi.fire(d.id, d.fire_date), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setShowFireConfirm(null); flash('success', 'Уволен') }, onError: () => flash('error', 'Ошибка') })
  const salaryMutation = useMutation({ mutationFn: () => employeesApi.calculateSalary({ employee_id: selectedEmployee!.id, ...salaryForm }), onSuccess: (res) => { setSalaryResult(res.data); qc.invalidateQueries({ queryKey: ['payroll'] }); flash('success', 'Рассчитано') }, onError: () => flash('error', 'Ошибка расчёта') })

  function flash(type: 'success' | 'error', text: string) { setMessage({ type, text }); setTimeout(() => setMessage(null), 4000) }
  function resetForm() {
    setForm({
      full_name: '',
      identification_number: '',
      position: '',
      salary: '',
      hire_date: today,
      has_children: 0,
      disability_group: '',
      is_pensioner: false,
      citizenship: '',
      work_hours_per_day: '',
      work_hours_per_week: '',
      id_document_type: '',
      id_doc_series: '',
      id_doc_number: '',
      id_doc_issued_by: '',
      id_doc_issued_date: '',
      id_doc_expiry_date: '',
    })
  }
  function closeModal() { setShowModal(false); setEditingEmployee(null); resetForm() }
  function openEdit(emp: Employee) {
    setEditingEmployee(emp)
    const dg = emp.disability_group
    setForm({
      full_name: emp.full_name,
      identification_number: emp.identification_number || '',
      position: emp.position,
      salary: String(emp.salary),
      hire_date: emp.hire_date,
      has_children: emp.has_children,
      disability_group: dg === 1 || dg === 2 || dg === 3 ? String(dg) as '1' | '2' | '3' : '',
      is_pensioner: !!emp.is_pensioner,
      citizenship: emp.citizenship || '',
      work_hours_per_day: emp.work_hours_per_day != null && emp.work_hours_per_day !== '' ? String(emp.work_hours_per_day) : '',
      work_hours_per_week: emp.work_hours_per_week != null && emp.work_hours_per_week !== '' ? String(emp.work_hours_per_week) : '',
      id_document_type: (emp.id_document_type || '') as IdDocType,
      id_doc_series: emp.id_document?.series || '',
      id_doc_number: emp.id_document?.number || '',
      id_doc_issued_by: emp.id_document?.issued_by || '',
      id_doc_issued_date: emp.id_document?.issued_date?.slice(0, 10) || '',
      id_doc_expiry_date: emp.id_document?.expiry_date?.slice(0, 10) || '',
    })
    setShowModal(true)
  }
  function openSalary(emp: Employee) { setSelectedEmployee(emp); setSalaryResult(null); setSalaryForm({ ...salaryForm, period_year: payrollYear, period_month: payrollMonth }); setShowSalaryModal(true) }
  function buildPayload(forEdit: boolean) {
    const disability_group =
      form.disability_group === '' ? null : (Number(form.disability_group) as 1 | 2 | 3)
    const work_hours_per_day =
      form.work_hours_per_day === '' ? null : Number(form.work_hours_per_day)
    const work_hours_per_week =
      form.work_hours_per_week === '' ? null : Number(form.work_hours_per_week)
    const base: Record<string, unknown> = {
      identification_number: form.identification_number || null,
      position: form.position,
      salary: Number(form.salary),
      has_children: form.has_children,
      disability_group,
      is_pensioner: form.is_pensioner,
      citizenship: form.citizenship.trim() || null,
      work_hours_per_day: Number.isFinite(work_hours_per_day as number) ? work_hours_per_day : null,
      work_hours_per_week: Number.isFinite(work_hours_per_week as number) ? work_hours_per_week : null,
    }
    if (form.id_document_type) {
      base.id_document_type = form.id_document_type
      base.id_document = {
        series: form.id_doc_series.trim() || null,
        number: form.id_doc_number.trim(),
        issued_by: form.id_doc_issued_by.trim(),
        issued_date: form.id_doc_issued_date,
        expiry_date: form.id_doc_expiry_date.trim() ? form.id_doc_expiry_date : null,
      }
    } else if (forEdit) {
      base.id_document_type = null
      base.id_document = null
    }
    return base
  }

  function handleSave() {
    if (form.id_document_type) {
      if (!form.id_doc_number.trim() || !form.id_doc_issued_by.trim() || !form.id_doc_issued_date) {
        flash('error', 'Заполните номер, кем выдан и дату выдачи документа')
        return
      }
    }
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, body: buildPayload(true) })
    } else {
      createMutation.mutate({
        full_name: form.full_name,
        hire_date: form.hire_date,
        ...buildPayload(false),
      })
    }
  }

  const employees: Employee[] = data ?? []
  const filtered = employees.filter(emp => {
    const byQ = !query.trim() || emp.full_name.toLowerCase().includes(query.toLowerCase()) || emp.position.toLowerCase().includes(query.toLowerCase())
    return byQ && (!onlyWithChildren || emp.has_children > 0)
  })
  const payroll: SalaryRecord[] = payrollData ?? []
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-7xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">Сотрудники</h1>
          <p className="mt-1 text-sm text-zinc-500">Команда, зарплаты и кадровый учёт</p>
        </div>
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() => {
            setEditingEmployee(null)
            resetForm()
            setShowModal(true)
          }}
        >
          <Icon name="person_add" className="text-lg" /> Добавить
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 border border-zinc-200/80 shadow-soft sm:inline-flex sm:min-w-0">
          {(
            [
              { key: 'active' as Tab, label: 'Активные', count: employees.length },
              { key: 'fired' as Tab, label: 'Уволенные' },
              { key: 'payroll' as Tab, label: 'Ведомость ЗП' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`tap-highlight-none whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:py-1.5 ${
                tab === t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}{' '}
              {'count' in t && t.count != null && <span className="opacity-60">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {isError && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">Не удалось загрузить</div>}

      {/* Payroll */}
      {tab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface-container-low p-4 border border-zinc-200/80 shadow-soft sm:gap-4 sm:p-5">
            <div>
              <label className="label">Год</label>
              <input type="number" className="input w-28 min-h-11 rounded-xl" value={payrollYear} onChange={(e) => setPayrollYear(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Месяц</label>
              <select
                className="input min-h-11 w-full min-w-[10rem] rounded-xl sm:w-40"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(Number(e.target.value))}
              >
                {MONTHS.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <span className="pb-2 text-sm text-zinc-500">
              {payrollLoading ? 'Загрузка...' : `${payroll.length} записей`}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface-container-low border border-zinc-200/80 shadow-soft">
            {payroll.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">{payrollLoading ? 'Загрузка...' : 'Нет расчётов'}</div>
            ) : (
              <>
                <ul className="divide-y divide-white/[0.05] md:hidden">
                  {payroll.map((r) => (
                    <li key={r.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Сотрудник</p>
                          <p className="font-mono text-xs text-zinc-500">{r.employee_id.slice(0, 8)}…</p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${
                            r.status === 'paid'
                              ? 'border border-secondary/20 bg-secondary/10 text-secondary'
                              : 'border border-outline-variant/20 bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          {r.status === 'paid' ? 'Выплачено' : 'Черновик'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500">К выдаче</span>
                          <p className="font-headline font-bold text-primary">{fmt(r.net_salary)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500">Начислено</span>
                          <p className="font-bold text-on-surface">{fmt(r.gross_salary)}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">НДФЛ</span>
                          <p className="text-red-300">{fmt(r.income_tax)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500">ФСЗН 34%</span>
                          <p className="text-violet-300">{fmt(r.fsszn_employer)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-[10px] font-label text-on-surface-variant tracking-widest uppercase bg-surface-container-high/50">
                    {['Сотрудник','Оклад','Бонус','Больн.','Отпуск.','Начисл.','НДФЛ','ФСЗН 1%','К выдаче','ФСЗН 34%','Статус'].map(h => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {payroll.map(r => (
                    <tr key={r.id} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-4 py-3 font-medium text-on-surface whitespace-nowrap">{r.employee_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-right">{fmt(r.base_salary)}</td>
                      <td className="px-4 py-3 text-right text-secondary">{fmt(r.bonus)}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.sick_pay)}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.vacation_pay)}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(r.gross_salary)}</td>
                      <td className="px-4 py-3 text-right text-error">{fmt(r.income_tax)}</td>
                      <td className="px-4 py-3 text-right text-error">{fmt(r.fsszn_employee)}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{fmt(r.net_salary)}</td>
                      <td className="px-4 py-3 text-right text-tertiary">{fmt(r.fsszn_employer)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase ${
                          r.status === 'paid' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
                        }`}>{r.status === 'paid' ? 'Выплачено' : 'Черновик'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Employee list */}
      {tab !== 'payroll' && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 border border-zinc-200/80 shadow-soft sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-5">
            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <label className="label">Поиск</label>
              <div className="relative">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-500" />
                <input
                  className="input min-h-11 rounded-xl pl-10"
                  placeholder="ФИО или должность"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 pb-1 text-sm text-zinc-500 sm:pb-2">
              <input type="checkbox" checked={onlyWithChildren} onChange={(e) => setOnlyWithChildren(e.target.checked)} className="rounded" />{' '}
              Только с детьми
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl bg-surface-container-low border border-zinc-200/80 shadow-soft">
            {isLoading ? (
              <div className="p-12 text-center text-sm text-zinc-500">Загружаем...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center sm:p-16">
                <Icon name="group" className="text-5xl text-on-surface-variant/20" />
                <p className="mt-4 text-sm text-zinc-500">{tab === 'fired' ? 'Уволенных нет' : 'Сотрудников пока нет'}</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-white/[0.05] lg:hidden">
                  {filtered.map((emp) => (
                    <li key={emp.id} className="p-4">
                      <div className="flex gap-3">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-100">
                          <Icon name="person" className="text-xl text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-headline text-sm font-bold text-on-surface">{emp.full_name}</p>
                          <p className="text-xs text-zinc-500">{emp.position}</p>
                          {emp.identification_number && (
                            <p className="mt-1 font-mono text-[10px] text-zinc-500">ИД {emp.identification_number}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span className="font-bold text-on-surface">{fmt(emp.salary)} BYN</span>
                            <span>·</span>
                            <span>{tab === 'fired' ? emp.fire_date || '—' : `с ${emp.hire_date}`}</span>
                            {emp.has_children > 0 && (
                              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                                детей: {emp.has_children}
                              </span>
                            )}
                            {emp.disability_group != null && (
                              <span className="rounded-md border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-950">
                                инв. {emp.disability_group} гр.
                              </span>
                            )}
                            {emp.is_pensioner && (
                              <span className="rounded-md border border-zinc-300/80 bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-700">
                                пенсионер
                              </span>
                            )}
                            {!emp.is_active && <span className="text-[10px] font-bold text-red-400">Уволен</span>}
                          </div>
                        </div>
                      </div>
                      {emp.is_active && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="tap-highlight-none flex flex-1 items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-white py-2.5 text-xs font-bold text-primary"
                            onClick={() => openSalary(emp)}
                          >
                            <Icon name="calculate" className="text-lg" /> Зарплата
                          </button>
                          <button
                            type="button"
                            className="tap-highlight-none flex flex-1 items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50 py-2.5 text-xs font-bold text-zinc-700"
                            onClick={() => openEdit(emp)}
                          >
                            <Icon name="edit" className="text-lg" /> Изменить
                          </button>
                          <button
                            type="button"
                            className="tap-highlight-none flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-300"
                            onClick={() => {
                              setShowFireConfirm(emp.id)
                              setFireDate(today)
                            }}
                            aria-label="Уволить"
                          >
                            <Icon name="person_remove" className="text-lg" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-[10px] font-label text-on-surface-variant tracking-widest uppercase bg-surface-container-high/50">
                    <th className="px-6 py-4 text-left">ФИО</th>
                    <th className="px-6 py-4 text-left">ИД номер</th>
                    <th className="px-6 py-4 text-left">Должность</th>
                    <th className="px-6 py-4 text-right">Оклад</th>
                    <th className="px-6 py-4 text-left">{tab === 'fired' ? 'Уволен' : 'Нанят'}</th>
                    <th className="px-6 py-4 text-center">Детей</th>
                    <th className="px-6 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {filtered.map(emp => (
                    <tr key={emp.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
                            <Icon name="person" className="text-primary text-lg" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{emp.full_name}</p>
                            {!emp.is_active && <span className="text-[10px] text-error font-bold">Уволен</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">{emp.identification_number || '—'}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{emp.position}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-on-surface">{fmt(emp.salary)} BYN</td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant">{tab === 'fired' ? emp.fire_date || '—' : emp.hire_date}</td>
                      <td className="px-6 py-4 text-center">
                        {emp.has_children > 0 ? <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 font-bold">{emp.has_children}</span> : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {emp.is_active && (
                            <>
                              <button onClick={() => openSalary(emp)} className="btn-ghost !text-xs !px-2 text-primary">
                                <Icon name="calculate" className="text-sm" />
                              </button>
                              <button onClick={() => openEdit(emp)} className="btn-ghost !text-xs !px-2">
                                <Icon name="edit" className="text-sm" />
                              </button>
                              <button onClick={() => { setShowFireConfirm(emp.id); setFireDate(today) }} className="btn-ghost !text-xs !px-2 text-error hover:text-error">
                                <Icon name="person_remove" className="text-sm" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showFireConfirm && (
        <AppModal
          title="Увольнение"
          onClose={() => setShowFireConfirm(null)}
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowFireConfirm(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
                disabled={fireMutation.isPending}
                onClick={() => fireMutation.mutate({ id: showFireConfirm, fire_date: fireDate })}
              >
                {fireMutation.isPending ? 'Увольняем...' : 'Уволить'}
              </button>
            </div>
          }
        >
          <p className="mb-4 text-sm text-zinc-400">Это действие нельзя отменить.</p>
          <div>
            <label className="label">Дата увольнения</label>
            <input
              type="date"
              className="input min-h-11 rounded-xl"
              value={fireDate}
              onChange={(e) => setFireDate(e.target.value)}
            />
          </div>
        </AppModal>
      )}

      {showModal && (
        <AppModal
          title={editingEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
          extraWide
          onClose={closeModal}
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-h-12 flex-1" onClick={closeModal}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary min-h-12 flex-1"
                disabled={!form.full_name || !form.position || !form.salary || isSaving}
                onClick={handleSave}
              >
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            <section>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Основное</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">ФИО</label>
                  <input
                    className="input min-h-11 rounded-xl"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    disabled={!!editingEmployee}
                  />
                </div>
                <div>
                  <label className="label">Идентификационный номер (личный)</label>
                  <input
                    className="input min-h-11 rounded-xl font-mono"
                    placeholder="1234567A001PB0"
                    maxLength={14}
                    value={form.identification_number}
                    onChange={(e) => setForm({ ...form, identification_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Гражданство</label>
                  <input
                    className="input min-h-11 rounded-xl"
                    placeholder="например, Республика Беларусь"
                    value={form.citizenship}
                    onChange={(e) => setForm({ ...form, citizenship: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Должность</label>
                  <input
                    className="input min-h-11 rounded-xl"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Оклад (BYN)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="input min-h-11 rounded-xl"
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  />
                </div>
                {!editingEmployee && (
                  <div>
                    <label className="label">Дата найма</label>
                    <input
                      type="date"
                      className="input min-h-11 rounded-xl"
                      value={form.hire_date}
                      onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Часов в день (ставка)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min={0}
                    max={24}
                    placeholder="8"
                    className="input min-h-11 rounded-xl"
                    value={form.work_hours_per_day}
                    onChange={(e) => setForm({ ...form, work_hours_per_day: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Часов в неделю</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    max={168}
                    placeholder="40"
                    className="input min-h-11 rounded-xl"
                    value={form.work_hours_per_week}
                    onChange={(e) => setForm({ ...form, work_hours_per_week: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Документ, удостоверяющий личность
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Вид документа</label>
                  <select
                    className="input min-h-11 rounded-xl"
                    value={form.id_document_type}
                    onChange={(e) =>
                      setForm({ ...form, id_document_type: e.target.value as IdDocType })
                    }
                  >
                    <option value="">— не указано —</option>
                    <option value="passport">Паспорт</option>
                    <option value="residence_permit">Вид на жительство</option>
                    <option value="refugee_certificate">Удостоверение беженца</option>
                    <option value="other">Иной документ</option>
                  </select>
                </div>
                {form.id_document_type ? (
                  <>
                    <div>
                      <label className="label">Серия</label>
                      <input
                        className="input min-h-11 rounded-xl font-mono"
                        value={form.id_doc_series}
                        onChange={(e) => setForm({ ...form, id_doc_series: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Номер</label>
                      <input
                        className="input min-h-11 rounded-xl font-mono"
                        value={form.id_doc_number}
                        onChange={(e) => setForm({ ...form, id_doc_number: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Кем выдан</label>
                      <input
                        className="input min-h-11 rounded-xl"
                        value={form.id_doc_issued_by}
                        onChange={(e) => setForm({ ...form, id_doc_issued_by: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Дата выдачи</label>
                      <input
                        type="date"
                        className="input min-h-11 rounded-xl"
                        value={form.id_doc_issued_date}
                        onChange={(e) => setForm({ ...form, id_doc_issued_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Срок действия (если есть)</label>
                      <input
                        type="date"
                        className="input min-h-11 rounded-xl"
                        value={form.id_doc_expiry_date}
                        onChange={(e) => setForm({ ...form, id_doc_expiry_date: e.target.value })}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Льготы и вычеты</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Детей (для вычета)</label>
                  <input
                    type="number"
                    min={0}
                    className="input min-h-11 rounded-xl"
                    value={form.has_children}
                    onChange={(e) => setForm({ ...form, has_children: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Инвалидность (группа)</label>
                  <select
                    className="input min-h-11 rounded-xl"
                    value={form.disability_group}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        disability_group: e.target.value as '' | '1' | '2' | '3',
                      })
                    }
                  >
                    <option value="">Нет</option>
                    <option value="1">I группа</option>
                    <option value="2">II группа</option>
                    <option value="3">III группа</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-3 text-sm text-zinc-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_pensioner}
                    onChange={(e) => setForm({ ...form, is_pensioner: e.target.checked })}
                    className="rounded"
                  />
                  Пенсионер (на учёте как получатель пенсии)
                </label>
              </div>
            </section>
          </div>
        </AppModal>
      )}

      {showSalaryModal && selectedEmployee && (
        <AppModal
          title="Расчёт зарплаты"
          wide
          onClose={() => {
            setShowSalaryModal(false)
            setSalaryResult(null)
          }}
          footer={
            <button
              type="button"
              className="btn-primary min-h-12 w-full"
              disabled={salaryMutation.isPending}
              onClick={() => salaryMutation.mutate()}
            >
              {salaryMutation.isPending ? 'Считаем...' : 'Рассчитать'}
            </button>
          }
        >
          <p className="text-sm font-semibold text-on-surface">{selectedEmployee.full_name}</p>
          <p className="mb-4 text-xs text-zinc-500">
            Оклад: {fmt(selectedEmployee.salary)} BYN · {selectedEmployee.position}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Год</label>
              <input
                type="number"
                className="input min-h-11 rounded-xl"
                value={salaryForm.period_year}
                onChange={(e) => setSalaryForm({ ...salaryForm, period_year: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Месяц</label>
              <select
                className="input min-h-11 rounded-xl"
                value={salaryForm.period_month}
                onChange={(e) => setSalaryForm({ ...salaryForm, period_month: Number(e.target.value) })}
              >
                {MONTHS.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Бонус</label>
              <input
                type="number"
                className="input min-h-11 rounded-xl"
                value={salaryForm.bonus}
                onChange={(e) => setSalaryForm({ ...salaryForm, bonus: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Больничные дни</label>
              <input
                type="number"
                min={0}
                className="input min-h-11 rounded-xl"
                value={salaryForm.sick_days}
                onChange={(e) => setSalaryForm({ ...salaryForm, sick_days: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Отпускные дни</label>
              <input
                type="number"
                min={0}
                className="input min-h-11 rounded-xl"
                value={salaryForm.vacation_days}
                onChange={(e) => setSalaryForm({ ...salaryForm, vacation_days: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Раб. дней</label>
              <input
                type="number"
                min={1}
                className="input min-h-11 rounded-xl"
                value={salaryForm.work_days_plan}
                onChange={(e) => setSalaryForm({ ...salaryForm, work_days_plan: Number(e.target.value) })}
              />
            </div>
          </div>
          {salaryResult && (
            <div className="mt-5 border-t border-zinc-200/80 pt-5">
              <h4 className="mb-3 text-sm font-bold text-on-surface">
                Расчётный лист — {MONTHS[salaryResult.period_month]} {salaryResult.period_year}
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <PR label="Оклад" value={fmt(salaryResult.base_salary)} />
                <PR label="Бонус" value={fmt(salaryResult.bonus)} color="text-secondary" />
                <PR label="Больничные" value={fmt(salaryResult.sick_pay)} />
                <PR label="Отпускные" value={fmt(salaryResult.vacation_pay)} />
                <div className="col-span-2 my-1 border-t border-zinc-200/70" />
                <PR label="Начислено" value={fmt(salaryResult.gross_salary)} bold />
                <PR label="НДФЛ 13%" value={`−${fmt(salaryResult.income_tax)}`} color="text-error" />
                <PR label="ФСЗН 1%" value={`−${fmt(salaryResult.fsszn_employee)}`} color="text-error" />
                <div className="col-span-2 my-1 border-t-2 border-zinc-300/80" />
                <PR label="К выдаче" value={`${fmt(salaryResult.net_salary)} BYN`} bold color="text-primary" />
                <PR label="ФСЗН 34%" value={fmt(salaryResult.fsszn_employer)} color="text-tertiary" sub />
              </div>
            </div>
          )}
        </AppModal>
      )}
    </div>
  )
}

function PR({ label, value, bold, color, sub }: { label: string; value: string; bold?: boolean; color?: string; sub?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={sub ? 'text-xs text-on-surface-variant' : 'text-on-surface-variant'}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${color || 'text-on-surface'} ${sub ? 'text-xs' : ''}`}>{value}</span>
    </div>
  )
}
