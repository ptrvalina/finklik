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
  to: '/scanner',
  label: 'Сканер',
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
  {
    to: '/bank',
    label: 'Банк',
    icon: 'account_balance_wallet',
    description: 'Операции, счета, курсы НБ РБ',
    flyout: [
      { to: '/transactions', label: 'Операции' },
      { to: '/currency', label: 'Курсы валют' },
    ],
  },
  { to: '/analytics', label: 'Аналитика', icon: 'insights', description: 'Отчёты и графики' },
  { to: '/calendar', label: 'Календарь', icon: 'calendar_today', description: 'Сроки и события' },
  { to: '/employees', label: 'Сотрудники', icon: 'group', description: 'Кадры и зарплата' },
  {
    to: '/reporting',
    label: 'Сдача отчётности',
    icon: 'assignment_turned_in',
    description: 'ИМНС, ФСЗН, Белгосстрах, Белстат',
    flyout: [
      { to: '/reporting/imns', label: 'ИМНС' },
      { to: '/reporting/fsszn', label: 'ФСЗН' },
      { to: '/reporting/belgosstrakh', label: 'Белгосстрах' },
      { to: '/reporting/belstat', label: 'Белстат' },
    ],
  },
  { to: '/documents', label: 'Документы', icon: 'description', description: 'Первичка и экспорт отчётов' },
  { to: '/counterparties', label: 'Контрагенты', icon: 'handshake', description: 'Клиенты и поставщики' },
  {
    to: '/onec-contour',
    label: '1С',
    icon: 'hub',
    description: 'Контур и синхронизация',
    flyout: [
      { to: '/onec-contour', label: 'Контур' },
      { to: '/onec-sync', label: 'Синхронизация' },
    ],
  },
]

type BarItem = { to: string; label: string; icon: string; end?: boolean }

/** Нижняя панель (мобильные): без отдельного FAB — сканер и в шапке. */
export const MOBILE_BAR_ITEMS: BarItem[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/transactions', label: 'Операции', icon: 'receipt_long' },
  { to: '/scanner', label: 'Сканер', icon: 'document_scanner' },
  { to: '/bank', label: 'Счета', icon: 'credit_card' },
]
