import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { employeesApi } from '../api/client'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import MoneyAmount from '../components/ui/MoneyAmount'
import {
  FilterBar,
  GlassCard,
  HeroGradient,
  PageHeader,
  StatCard,
  StatusChip,
  StitchIcon,
  StitchTable,
  StitchTableShell,
} from '../components/stitch'
import {
  EMPLOYMENT_LABEL,
  type EmployeeRow,
  type EmployeeSortKey,
  employmentType,
  sortEmployees,
  totalDependents,
  workHoursPerWeek,
} from '../lib/employeeListUtils'

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<EmployeeSortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data, isLoading } = useQuery({
    queryKey: ['employees', tab],
    queryFn: () =>
      employeesApi
        .list(tab === 'active' ? { active_only: true } : { active_only: false, inactive_only: true })
        .then((r) => r.data as EmployeeRow[]),
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

  const stats = useMemo(() => {
    const payroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0)
    const primary = employees.filter((e) => employmentType(e) === 'primary').length
    const withDependents = employees.filter((e) => totalDependents(e) > 0).length
    return { total: employees.length, payroll, primary, withDependents }
  }, [employees])

  function toggleSortDir() {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
  }

  function openDossier(id: string, edit = false) {
    navigate(`/employees/dossier/${id}`, { state: edit ? { edit: true } : undefined })
  }

  return (
    <div className="space-y-section-sm pb-8">
      <PageHeader
        backTo="/employees"
        backLabel="Команда"
        title="Сотрудники"
        subtitle="Список работников — откройте карточку для просмотра и корректировки данных."
        actions={
          <Link to="/employees/hire" className="btn-primary flex min-h-touch-min items-center gap-2 rounded-full px-5 text-sm">
            <StitchIcon name="person_add" className="text-lg" />
            Принять
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-gutter md:grid-cols-4">
        <HeroGradient className="md:col-span-2">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <p className="font-label text-label-caps uppercase opacity-70">
                {tab === 'active' ? 'Работающие' : 'Уволенные'}
              </p>
              <p className="mt-2 font-headline text-headline-md">{stats.total}</p>
              <p className="mt-1 text-sm opacity-80">
                {tab === 'active' ? 'сотрудников в штате' : 'записей в архиве'}
              </p>
            </div>
            <p className="mt-6 text-xs opacity-70">
              Показано {rows.length} из {stats.total} после фильтрации
            </p>
          </div>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-container opacity-40 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-tertiary-container opacity-30 blur-[80px]" />
        </HeroGradient>
        <StatCard
          icon="work"
          label="Основное место"
          value={stats.primary}
          hint={`из ${stats.total} в текущем списке`}
        />
        <StatCard
          icon="payments"
          iconTint="tertiary"
          label="Фонд оплаты"
          value={<MoneyAmount value={stats.payroll} className="inline-flex" />}
          hint="сумма окладов"
        />
      </section>

      <FilterBar className="flex-col sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-max gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-high p-1">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'active' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Работают
          </button>
          <button
            type="button"
            onClick={() => setTab('fired')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'fired' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Уволенные
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-[200px]">
            <label className="label">Поиск</label>
            <div className="relative">
              <StitchIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
              />
              <input
                className="input min-h-touch-min w-full rounded-xl pl-10"
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
                className="input min-h-touch-min min-w-[12rem] rounded-xl"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as EmployeeSortKey)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary min-h-touch-min px-3"
                onClick={toggleSortDir}
                title="Направление"
              >
                <StitchIcon name={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'} className="text-lg" />
              </button>
            </div>
          </div>
        </div>
      </FilterBar>

      <StitchTableShell
        title={tab === 'active' ? 'Штат сотрудников' : 'Архив уволенных'}
        toolbar={
          <span className="text-xs font-medium text-secondary">
            {rows.length} {rows.length === 1 ? 'запись' : 'записей'}
          </span>
        }
      >
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
                  <Link to="/employees/hire" className="btn-secondary min-h-touch-min px-5 text-sm">
                    Перейти к приёму
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-outline-variant/10 lg:hidden">
              {rows.map((emp) => (
                <li key={emp.id} className="flex items-stretch">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 gap-3 p-4 text-left transition hover:bg-surface-container-high"
                    onClick={() => openDossier(emp.id)}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                      {initials(emp.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-on-surface">{emp.full_name}</p>
                      <p className="text-xs text-on-surface-variant">{emp.position}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusChip variant={tab === 'active' ? 'ready' : 'error'}>
                          {tab === 'active' ? 'Работает' : 'Уволен'}
                        </StatusChip>
                        <StatusChip variant="neutral">{EMPLOYMENT_LABEL[employmentType(emp)]}</StatusChip>
                      </div>
                    </div>
                    <MoneyAmount value={emp.salary} className="shrink-0 text-sm font-bold" />
                  </button>
                  <button
                    type="button"
                    className="flex w-12 shrink-0 items-center justify-center border-l border-outline-variant/10 text-primary"
                    aria-label="Редактировать"
                    onClick={() => openDossier(emp.id, true)}
                  >
                    <StitchIcon name="edit" className="text-xl" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden lg:block">
              <StitchTable>
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Должность</th>
                    <th>Статус</th>
                    <th>Занятость</th>
                    <th className="text-right">Ставка</th>
                    <th className="text-right">Оклад</th>
                    <th className="text-center">Ижд.</th>
                    <th className="text-center">Инв.</th>
                    <th>{tab === 'fired' ? 'Уволен' : 'Принят'}</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp) => (
                    <tr key={emp.id} className="group">
                      <td className="cursor-pointer" onClick={() => openDossier(emp.id)}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {initials(emp.full_name)}
                          </div>
                          <div>
                            <p className="font-semibold text-on-surface">{emp.full_name}</p>
                            {emp.identification_number && (
                              <p className="font-mono text-xs text-secondary">{emp.identification_number}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="cursor-pointer text-on-surface-variant" onClick={() => openDossier(emp.id)}>
                        {emp.position}
                      </td>
                      <td className="cursor-pointer" onClick={() => openDossier(emp.id)}>
                        <StatusChip variant={tab === 'active' ? 'ready' : 'error'}>
                          {tab === 'active' ? 'Работает' : 'Уволен'}
                        </StatusChip>
                      </td>
                      <td className="cursor-pointer" onClick={() => openDossier(emp.id)}>
                        <StatusChip variant="neutral">{EMPLOYMENT_LABEL[employmentType(emp)]}</StatusChip>
                      </td>
                      <td
                        className="cursor-pointer text-right font-mono text-on-surface-variant"
                        onClick={() => openDossier(emp.id)}
                      >
                        {workHoursPerWeek(emp)} ч
                      </td>
                      <td className="cursor-pointer text-right font-semibold" onClick={() => openDossier(emp.id)}>
                        <MoneyAmount value={emp.salary} className="inline-flex justify-end" />
                      </td>
                      <td className="cursor-pointer text-center font-mono" onClick={() => openDossier(emp.id)}>
                        {totalDependents(emp) || '—'}
                      </td>
                      <td className="cursor-pointer text-center" onClick={() => openDossier(emp.id)}>
                        {emp.disability_group ?? '—'}
                      </td>
                      <td className="cursor-pointer text-xs text-on-surface-variant" onClick={() => openDossier(emp.id)}>
                        {tab === 'fired' ? emp.fire_date || '—' : emp.hire_date}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost !p-2 opacity-60 group-hover:opacity-100"
                          aria-label="Редактировать"
                          onClick={() => openDossier(emp.id, true)}
                        >
                          <StitchIcon name="edit" className="text-lg text-primary" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </StitchTable>
            </div>
          </>
        )}
      </StitchTableShell>

      {stats.withDependents > 0 && (
        <GlassCard className="flex items-start gap-4 p-5" hover={false}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary">
            <StitchIcon name="family_restroom" filled />
          </div>
          <div>
            <h3 className="font-headline text-headline-sm text-on-surface">Иждивенцы</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              У {stats.withDependents} сотрудников указаны иждивенцы — проверьте данные перед расчётом налогов и ФСЗН.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
