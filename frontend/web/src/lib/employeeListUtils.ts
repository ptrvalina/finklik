export type HrMeta = {
  employment_type?: 'primary' | 'secondary'
  subdivision?: string
  dependents_children?: number
  dependents_other?: number
  personnel_documents?: PersonnelDocument[]
}

export type PersonnelDocument = {
  id: string
  doc_type: string
  title: string
  uploaded_at: string
  mime_type: string
  file_name: string
  data_url?: string
}

export type EmployeeRow = {
  id: string
  full_name: string
  identification_number?: string | null
  position: string
  position_name?: string | null
  salary: number
  hire_date: string
  fire_date: string | null
  is_active: boolean
  has_children: number
  disability_group?: number | null
  is_pensioner?: boolean
  work_hours_per_day?: number | string | null
  work_hours_per_week?: number | string | null
  hr_meta?: HrMeta | null
}

export type EmployeeSortKey =
  | 'name'
  | 'position'
  | 'salary'
  | 'employment_type'
  | 'work_hours'
  | 'dependents'
  | 'disability'
  | 'date'

export const EMPLOYMENT_LABEL: Record<string, string> = {
  primary: 'Основное место',
  secondary: 'Совместительство',
}

export function employmentType(emp: EmployeeRow): 'primary' | 'secondary' {
  return emp.hr_meta?.employment_type === 'secondary' ? 'secondary' : 'primary'
}

export function totalDependents(emp: EmployeeRow): number {
  const hr = emp.hr_meta
  if (hr?.dependents_children != null || hr?.dependents_other != null) {
    return (hr.dependents_children ?? 0) + (hr.dependents_other ?? 0)
  }
  return emp.has_children
}

export function workHoursPerWeek(emp: EmployeeRow): number {
  if (emp.work_hours_per_week != null && emp.work_hours_per_week !== '') {
    return Number(emp.work_hours_per_week) || 0
  }
  if (emp.work_hours_per_day != null && emp.work_hours_per_day !== '') {
    return Number(emp.work_hours_per_day) * 5 || 0
  }
  return 40
}

export function sortEmployees(list: EmployeeRow[], key: EmployeeSortKey, dir: 'asc' | 'desc'): EmployeeRow[] {
  const mul = dir === 'asc' ? 1 : -1
  const sorted = [...list].sort((a, b) => {
    switch (key) {
      case 'name':
        return a.full_name.localeCompare(b.full_name, 'ru') * mul
      case 'position':
        return a.position.localeCompare(b.position, 'ru') * mul
      case 'salary':
        return (Number(a.salary) - Number(b.salary)) * mul
      case 'employment_type':
        return employmentType(a).localeCompare(employmentType(b)) * mul
      case 'work_hours':
        return (workHoursPerWeek(a) - workHoursPerWeek(b)) * mul
      case 'dependents':
        return (totalDependents(a) - totalDependents(b)) * mul
      case 'disability': {
        const da = a.disability_group ?? 99
        const db = b.disability_group ?? 99
        return (da - db) * mul
      }
      case 'date': {
        const da = a.is_active ? a.hire_date : a.fire_date || a.hire_date
        const db = b.is_active ? b.hire_date : b.fire_date || b.hire_date
        return da.localeCompare(db) * mul
      }
      default:
        return 0
    }
  })
  return sorted
}
