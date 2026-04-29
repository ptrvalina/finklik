/** Единый список разделов — сайдбар (desktop), сетка «Все сервисы» (mobile). */
export type NavFlyoutItem = { to: string; label: string }

export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  description?: string
  /** Подменю при наведении (desktop); на мобильных разворачивается в `flattenNavForSheet`. */
  flyout?: NavFlyoutItem[]
}

/** Плоский список для нижнего листа «Все сервисы» на мобильных. */
export function flattenNavForSheet(
  items: NavItem[],
): Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }> {
  const out: Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }> = []
  for (const it of items) {
    if (it.flyout?.length) {
      out.push({ to: it.to, label: it.label, icon: it.icon, end: true, description: it.description })
      for (const c of it.flyout) {
        out.push({ to: c.to, label: c.label, icon: it.icon, end: true })
      }
    } else {
      out.push({ to: it.to, label: it.label, icon: it.icon, end: it.end, description: it.description })
    }
  }
  return out
}

/** Консультант вынесен вниз сайдбара (desktop); в списке «Все сервисы» на мобильных добавляется отдельно. */
export const ASSISTANT_SHEET_ITEM = {
  to: '/assistant',
  label: 'Консультант',
  icon: 'smart_toy',
  end: true as const,
  description: 'ИИ-подсказки по учёту',
}

export const SCANNER_SHEET_ITEM = {
  to: '/scan',
  label: 'Скан',
  icon: 'document_scanner',
  end: true as const,
  description: 'Документы и OCR',
}

export function flattenNavForSheetWithAssistant(
  items: NavItem[],
): Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }> {
  return [...flattenNavForSheet(items), ASSISTANT_SHEET_ITEM, SCANNER_SHEET_ITEM]
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: 'dashboard', end: true, description: 'Сводка и метрики' },
  { to: '/planner', label: 'Планер', icon: 'event_note', description: 'Задачи и отчёты команды' },
  { to: '/bank', label: 'Банк', icon: 'account_balance_wallet', description: 'Платежи, выписки, счета' },
  { to: '/reports', label: 'Отчетность', icon: 'assignment_turned_in', description: 'Налоговые и регламентные отчёты' },
  { to: '/employees', label: 'Сотрудники', icon: 'group', description: 'Кадры и зарплата' },
  { to: '/accounting', label: 'Учет', icon: 'description', description: 'Операции, документы, бухгалтерия' },
  { to: '/counterparties', label: 'Контрагенты', icon: 'handshake', description: 'Клиенты и поставщики' },
  { to: '/websites', label: 'Сайты для работы', icon: 'language', description: 'Подборка рабочих сервисов' },
  { to: '/notes', label: 'Заметки', icon: 'note_alt', description: 'Личные и командные заметки' },
  { to: '/scan', label: 'Скан', icon: 'document_scanner', description: 'Сканирование и OCR' },
]

type BarItem = { to: string; label: string; icon: string; end?: boolean }

/** Нижняя панель (мобильные): без отдельного FAB — сканер и в шапке. */
export const MOBILE_BAR_ITEMS: BarItem[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/bank', label: 'Банк', icon: 'credit_card' },
  { to: '/reports', label: 'Отчетность', icon: 'assignment_turned_in' },
  { to: '/scan', label: 'Скан', icon: 'document_scanner' },
]

const MANAGER_ALLOWED = new Set(['/', '/scan', '/planner'])

export function getNavItemsForRole(role?: string | null): NavItem[] {
  if ((role || '').toLowerCase() !== 'manager') return ALL_NAV_ITEMS
  return ALL_NAV_ITEMS.filter((item) => MANAGER_ALLOWED.has(item.to))
}

export function getMobileBarItemsForRole(role?: string | null): BarItem[] {
  if ((role || '').toLowerCase() !== 'manager') return MOBILE_BAR_ITEMS
  return [
    { to: '/', label: 'Главная', icon: 'home', end: true },
    { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
    { to: '/planner', label: 'Планер', icon: 'event_note' },
  ]
}
