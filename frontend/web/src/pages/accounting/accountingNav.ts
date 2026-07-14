/** Горизонтальная навигация зоны «Учёт» — одинаковая на всех экранах. */

import { filterRoutes, type ProductContour } from '../../lib/productContour'

export type AccountingNavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  description?: string
}

export const ACCOUNTING_NAV: AccountingNavItem[] = [
  { to: '/accounting/journal', label: 'Журнал', icon: 'receipt_long', end: true, description: 'Доходы и расходы из банка, скана и ручного ввода' },
  { to: '/accounting/kudir', label: 'КУДиР', icon: 'menu_book', description: 'Книга учёта доходов и расходов за год' },
  { to: '/accounting/taxes', label: 'Налоги', icon: 'calculate', description: 'УСН, ФСЗН и сроки уплаты' },
  { to: '/reports', label: 'Отчёты', icon: 'assignment_turned_in', description: 'Подготовка и подача (workflow)' },
]

export function getAccountingNav(contour?: ProductContour | null): AccountingNavItem[] {
  if (!contour) return ACCOUNTING_NAV
  return filterRoutes(ACCOUNTING_NAV, contour)
}

export const ACCOUNTING_WORKFLOW = [
  {
    step: 1,
    title: 'Зафиксируйте операции',
    detail: 'Импорт из банка, скан чека или ручной ввод — всё попадает в журнал.',
    icon: 'edit_note',
    to: '/accounting/journal?focus=capture',
  },
  {
    step: 2,
    title: 'Подтвердите черновики',
    detail: '«Провести» = операция учтена для КУДиР и отчётности (не бухгалтерская проводка Дт/Кт).',
    icon: 'check_circle',
    to: '/accounting/journal?filter=drafts',
  },
  {
    step: 3,
    title: 'Сверьте КУДиР',
    detail: 'Книга доходов и расходов за год — основа для УСН и декларации в ИМНС.',
    icon: 'menu_book',
    to: '/accounting/kudir',
  },
  {
    step: 4,
    title: 'Сдайте отчёты',
    detail: 'ИМНС, ФСЗН, Белгосстрах — после закрытия периода в журнале.',
    icon: 'assignment_turned_in',
    to: '/reports',
  },
] as const
