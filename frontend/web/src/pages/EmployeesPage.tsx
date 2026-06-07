import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { employeesApi } from '../api/client'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import MoneyAmount from '../components/ui/MoneyAmount'
import {
  EMPLOYMENT_LABEL,
  type EmployeeRow,
  type EmployeeSortKey,
  employmentType,
  sortEmployees,
  totalDependents,
  workHoursPerWeek,
} from '../lib/employeeListUtils'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

type Tab = 'active' | 'fired'

const SORT_OPTIONS: { key: EmployeeSortKey; label: string }[] = [
  { key: 'name', label: 'ФИО' },
  { key: 'position', label: 'Должность' },
  { key: 'employment_type', label: 'Основное / совместительство' },
  { key: 'salary', label: 'Оклад' },
  { key: 'work_hours', label: 'Ставка (ч/нед)' },
  { key: 'dependents', label: 'Иждивенцы' },
  { key: 'disability', label: 'Инвалидность' },
  { key: 'date', label: 'Дата приёма / увольнения' },
]

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<EmployeeSortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const activeOnly = tab === 'active'
  const { data, isLoading } = useQuery({
    queryKey: ['employees', activeOnly],
    queryFn: () => employeesApi.list({ active_only: activeOnly }).then((r) => r.data as EmployeeRow[]),
  })

  const employees = data ?? []

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = employees.filter(
      (e) =>
        !q ||
        e.full_name.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        (e.identification_number || '').includes(q),
    )
    list = sortEmployees(list, sortKey, sortDir)
    return list
  }, [employees, query, sortKey, sortDir])

  function toggleSortDir() {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
  }

  function openDossier(id: string, edit = false) {
    navigate(`/employees/dossier/${id}`, { state: edit ? { edit: true } : undefined })
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/employees" className="btn-ghost !px-0 !text-xs text-on-surface-variant">
          <Icon name="arrow_back" className="text-sm" /> Команда
        </Link>
        <h1 className="page-heading mt-2">Сотрудники</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Список работников — откройте карточку для просмотра и корректировки данных.
        </p>
      </div>

      <div className="mb-4 flex min-w-max gap-1 rounded-xl border border-outline/75 bg-surface-container-high p-1 sm:inline-flex">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'active' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
        >
          Работают
        </button>
        <button
          type="button"
          onClick={() => setTab('fired')}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'fired' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
        >
          Уволенные
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-outline/75 bg-surface-container-low p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[200px]">
          <label className="label">Поиск</label>
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
            <input
              className="input min-h-11 w-full rounded-xl pl-10"
              placeholder="ФИО, должность или ИД"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Сортировка</label>
          <div className="flex gap-2">
            <select
              className="input min-h-11 min-w-[12rem] rounded-xl"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as EmployeeSortKey)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary min-h-11 px-3" onClick={toggleSortDir} title="Направление">
              <Icon name={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} className="p-4" />
        ) : rows.length === 0 ? (
          <div className="p-8">
            <PremiumEmptyState
              variant="compact"
              icon="groups"
              title={tab === 'fired' ? 'Уволенных нет' : 'Сотрудников пока нет'}
              description={
                tab === 'fired'
                  ? 'Здесь появятся бывшие работники после оформления увольнения.'
                  : 'Добавьте сотрудника через раздел «Приём» в команде.'
              }
              actions={
                tab === 'active' ? (
                  <Link to="/employees/hire" className="btn-secondary min-h-11 px-5 text-sm">
                    Перейти к приёму
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-outline/10 lg:hidden">
              {rows.map((emp) => (
                <li key={emp.id} className="flex items-stretch">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 gap-3 p-4 text-left transition hover:bg-surface-container-high"
                    onClick={() => openDossier(emp.id)}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Icon name="person" className="text-xl text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-on-surface">{emp.full_name}</p>
                      <p className="text-xs text-on-surface-variant">{emp.position}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                        <Tag>{EMPLOYMENT_LABEL[employmentType(emp)]}</Tag>
                        <Tag>{workHoursPerWeek(emp)} ч/нед</Tag>
                        {totalDependents(emp) > 0 && <Tag>ижд. {totalDependents(emp)}</Tag>}
                        {emp.disability_group != null && <Tag>инв. {emp.disability_group}</Tag>}
                      </div>
                    </div>
                    <MoneyAmount value={emp.salary} className="shrink-0 text-sm font-bold" />
                  </button>
                  <button
                    type="button"
                    className="flex w-12 shrink-0 items-center justify-center border-l border-outline/10 text-primary"
                    aria-label="Редактировать"
                    onClick={() => openDossier(emp.id, true)}
                  >
                    <Icon name="edit" className="text-xl" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-4 py-3">ФИО</th>
                    <th className="px-4 py-3">Должность</th>
                    <th className="px-4 py-3">Занятость</th>
                    <th className="px-4 py-3 text-right">Ставка</th>
                    <th className="px-4 py-3 text-right">Оклад</th>
                    <th className="px-4 py-3 text-center">Ижд.</th>
                    <th className="px-4 py-3 text-center">Инв.</th>
                    <th className="px-4 py-3">{tab === 'fired' ? 'Уволен' : 'Принят'}</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp) => (
                    <tr key={emp.id} className="group transition hover:bg-surface-container-high">
                      <td
                        className="cursor-pointer px-4 py-3 font-semibold text-on-surface"
                        onClick={() => openDossier(emp.id)}
                      >
                        {emp.full_name}
                      </td>
                      <td className="cursor-pointer px-4 py-3 text-on-surface-variant" onClick={() => openDossier(emp.id)}>
                        {emp.position}
                      </td>
                      <td className="cursor-pointer px-4 py-3 text-xs" onClick={() => openDossier(emp.id)}>
                        {EMPLOYMENT_LABEL[employmentType(emp)]}
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3 text-right tabular-nums text-on-surface-variant"
                        onClick={() => openDossier(emp.id)}
                      >
                        {workHoursPerWeek(emp)} ч
                      </td>
                      <td className="cursor-pointer px-4 py-3 text-right font-semibold" onClick={() => openDossier(emp.id)}>
                        <MoneyAmount value={emp.salary} className="inline-flex justify-end" />
                      </td>
                      <td className="cursor-pointer px-4 py-3 text-center tabular-nums" onClick={() => openDossier(emp.id)}>
                        {totalDependents(emp) || '—'}
                      </td>
                      <td className="cursor-pointer px-4 py-3 text-center" onClick={() => openDossier(emp.id)}>
                        {emp.disability_group ?? '—'}
                      </td>
                      <td className="cursor-pointer px-4 py-3 text-xs text-on-surface-variant" onClick={() => openDossier(emp.id)}>
                        {tab === 'fired' ? emp.fire_date || '—' : emp.hire_date}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="btn-ghost !p-2 opacity-60 group-hover:opacity-100"
                          aria-label="Редактировать"
                          onClick={() => openDossier(emp.id, true)}
                        >
                          <Icon name="edit" className="text-lg text-primary" />
                        </button>
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
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-outline/40 bg-surface px-1.5 py-0.5 font-medium text-on-surface-variant">
      {children}
    </span>
  )
}
