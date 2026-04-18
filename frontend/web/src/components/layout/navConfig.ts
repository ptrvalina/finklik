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

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: 'dashboard', end: true, description: 'Сводка и метрики' },
  { to: '/transactions', label: 'Операции', icon: 'receipt_long', description: 'Доходы и расходы' },
  { to: '/analytics', label: 'Аналитика', icon: 'insights', description: 'Отчёты и графики' },
  { to: '/calendar', label: 'Календарь', icon: 'calendar_today', description: 'Сроки и события' },
  { to: '/employees', label: 'Сотрудники', icon: 'group', description: 'Кадры и зарплата' },
  { to: '/taxes', label: 'Налоги', icon: 'account_balance', description: 'УСН, взносы' },
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
  { to: '/bank', label: 'Банк', icon: 'credit_card', description: 'Счета и платежи' },
  { to: '/currency', label: 'Курсы валют', icon: 'currency_exchange', description: 'НБ РБ и конвертер' },
  { to: '/counterparties', label: 'Контрагенты', icon: 'handshake', description: 'Клиенты и поставщики' },
  { to: '/onec-contour', label: 'Контур 1С', icon: 'hub', description: 'Реестр контура и health' },
  { to: '/onec-sync', label: 'Синхронизация 1С', icon: 'sync_alt', description: 'Очередь синхронизации и ошибки' },
  { to: '/scanner', label: 'Сканер', icon: 'document_scanner', description: 'Документы и OCR' },
  { to: '/assistant', label: 'Консультант', icon: 'smart_toy', description: 'ИИ-подсказки по учёту' },
  { to: '/settings', label: 'Настройки', icon: 'settings', description: 'Команда и compliance' },
]

type BarItem = { to: string; label: string; icon: string; end?: boolean }

/** Слева и справа от центральной кнопки сканера. */
export const MOBILE_BAR_LEFT: BarItem[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/transactions', label: 'Операции', icon: 'receipt_long' },
]

export const MOBILE_BAR_RIGHT: BarItem[] = [
  { to: '/bank', label: 'Банк', icon: 'account_balance_wallet' },
]

export const MOBILE_SCANNER = { to: '/scanner', label: 'Сканер', icon: 'document_scanner' } as const
