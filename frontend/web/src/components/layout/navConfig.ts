/** Единый список разделов — сайдбар (desktop), сетка «Все сервисы» (mobile). */
export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  description?: string
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: 'dashboard', end: true, description: 'Сводка и метрики' },
  { to: '/transactions', label: 'Операции', icon: 'receipt_long', description: 'Доходы и расходы' },
  { to: '/analytics', label: 'Аналитика', icon: 'insights', description: 'Отчёты и графики' },
  { to: '/calendar', label: 'Календарь', icon: 'calendar_today', description: 'Сроки и события' },
  { to: '/employees', label: 'Сотрудники', icon: 'group', description: 'Кадры и зарплата' },
  { to: '/taxes', label: 'Налоги', icon: 'account_balance', description: 'УСН, взносы' },
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
