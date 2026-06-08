/** Коды табеля (ориентир — листок учёта рабочего времени, ТК РБ). */

export type TimesheetCode = {
  code: string
  label: string
  /** Подставляется автоматически из кадровых приказов */
  auto?: boolean
}

export const TIMESHEET_CODES: TimesheetCode[] = [
  { code: 'Я', label: 'Явка' },
  { code: 'Р', label: 'Работа в выходной' },
  { code: 'В', label: 'Выходной' },
  { code: 'Б', label: 'Больничный' },
  { code: 'О', label: 'Трудовой отпуск', auto: true },
  { code: 'С', label: 'Социальный отпуск', auto: true },
  { code: 'Н', label: 'Неявка' },
  { code: 'П', label: 'Простой' },
  { code: 'Д', label: 'Отпуск без сохранения' },
  { code: 'К', label: 'Командировка' },
  { code: 'У', label: 'Учебный отпуск' },
  { code: 'Т', label: 'Отпуск по беременности' },
  { code: 'Х', label: 'Выполнение гос. обязанностей' },
  { code: 'Ч', label: 'Доп. выходной' },
]

export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
