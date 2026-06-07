/** Business-first IA — Главная / Банк / Отчётность / Команда / Контрагенты / Настройки. */

export type ZoneId = 'today' | 'money' | 'reporting' | 'team' | 'clients' | 'settings'

export type ZoneMeta = {
  id: ZoneId
  label: string
  icon: string
  defaultTo: string
}

export const ZONES: ZoneMeta[] = [
  { id: 'today', label: 'Главная', icon: 'hub', defaultTo: '/' },
  { id: 'money', label: 'Банк', icon: 'account_balance', defaultTo: '/bank' },
  { id: 'reporting', label: 'Отчётность', icon: 'assignment_turned_in', defaultTo: '/reports' },
  { id: 'team', label: 'Команда', icon: 'groups', defaultTo: '/employees' },
  { id: 'clients', label: 'Контрагенты', icon: 'handshake', defaultTo: '/counterparties' },
  { id: 'settings', label: 'Настройки', icon: 'settings', defaultTo: '/settings' },
]

export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  description?: string
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'today',
    label: 'Главная',
    items: [
      { to: '/', label: 'Обзор', icon: 'hub', end: true, description: 'Баланс, риски и ближайшие сроки' },
      { to: '/inbox', label: 'Очередь', icon: 'inbox', end: true, description: 'Входящие и согласования' },
      { to: '/operations', label: 'Все задачи', icon: 'bolt', end: true, description: 'Полная лента исполнения' },
    ],
  },
  {
    id: 'money',
    label: 'Банк',
    items: [
      { to: '/bank', label: 'Банк', icon: 'account_balance', end: true, description: 'Счёт, выписка и платежи' },
      { to: '/accounting/journal', label: 'Журнал', icon: 'menu_book', end: true, description: 'Проводки по операциям' },
      { to: '/scan', label: 'Сканер', icon: 'document_scanner', end: true, description: 'Первичные документы' },
      { to: '/documents', label: 'Документы', icon: 'folder', end: true, description: 'Счета и акты' },
    ],
  },
  {
    id: 'reporting',
    label: 'Отчётность',
    items: [
      { to: '/reports', label: 'Отчёты', icon: 'assignment_turned_in', end: true, description: 'Готовность и подача' },
      { to: '/calendar', label: 'Календарь', icon: 'event', end: true, description: 'Налоги, отчёты и сроки' },
      { to: '/planner', label: 'Задачи команды', icon: 'task_alt', end: true, description: 'Поручения сотрудникам' },
    ],
  },
  {
    id: 'team',
    label: 'Команда',
    items: [
      { to: '/employees', label: 'Команда', icon: 'groups', end: true, description: 'Приём, табель и кадровые процессы' },
      { to: '/employees/list', label: 'Сотрудники', icon: 'badge', end: true, description: 'Список и личные дела' },
    ],
  },
  {
    id: 'clients',
    label: 'Контрагенты',
    items: [
      { to: '/counterparties', label: 'Справочник', icon: 'handshake', end: true, description: 'Партнёры, УНП и сальдо' },
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    items: [
      { to: '/settings', label: 'Профиль', icon: 'settings', end: true, description: 'Организация и команда' },
      { to: '/accounting/chart', label: 'План счетов', icon: 'table_chart', end: true },
      { to: '/analytics', label: 'Аналитика', icon: 'insights', end: true },
      { to: '/assistant', label: 'Консультант', icon: 'smart_toy', end: true },
    ],
  },
]

const MANAGER_ALLOWED = new Set(['/', '/inbox', '/operations', '/scan', '/planner'])

function filterNavGroups(groups: NavGroup[], allowed: Set<string>): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.to)) }))
    .filter((g) => g.items.length > 0)
}

function augmentClientsNav(groups: NavGroup[]): NavGroup[] {
  const idx = groups.findIndex((g) => g.id === 'clients')
  if (idx < 0) return groups
  const clients = groups[idx]
  if (clients.items.some((i) => i.to === '/workspace/queues')) return groups
  const wsItems: NavItem[] = [
    { to: '/workspace/queues', label: 'Очереди клиентов', icon: 'all_inbox', end: true, description: 'Сроки и OCR' },
    { to: '/workspace', label: 'Организации', icon: 'corporate_fare', end: true, description: 'Переключение клиентов' },
  ]
  return groups.map((g, i) => (i === idx ? { ...g, items: [...wsItems, ...clients.items] } : g))
}

export function getNavGroupsForRole(role?: string | null): NavGroup[] {
  const r = (role || '').toLowerCase()
  if (r === 'manager') return filterNavGroups(NAV_GROUPS, MANAGER_ALLOWED)
  let groups = r === 'accountant' || r === 'owner' ? augmentClientsNav(NAV_GROUPS) : NAV_GROUPS
  if (r === 'viewer') {
    groups = groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.to !== '/operations') }))
      .filter((g) => g.items.length > 0)
  }
  return groups
}

export function flattenNavForSheet(items: NavItem[]) {
  return items.map((it) => ({
    to: it.to,
    label: it.label,
    icon: it.icon,
    end: it.end ?? true,
    description: it.description,
  }))
}

export const ASSISTANT_SHEET_ITEM = {
  to: '/assistant',
  label: 'Консультант',
  icon: 'smart_toy',
  end: true as const,
  description: 'Помощь по учёту и отчётности',
}

export function flattenNavForSheetWithAssistant(items: NavItem[]) {
  const seen = new Set<string>()
  return [...flattenNavForSheet(items), ASSISTANT_SHEET_ITEM].filter((r) => {
    if (seen.has(r.to)) return false
    seen.add(r.to)
    return true
  })
}

export const MOBILE_BAR_ITEMS = [
  { to: '/', label: 'Главная', icon: 'hub', end: true },
  { to: '/bank', label: 'Банк', icon: 'account_balance' },
  { to: '/reports', label: 'Отчётность', icon: 'assignment_turned_in' },
  { to: '/counterparties', label: 'Контрагенты', icon: 'handshake', end: true },
]

export function getMobileBarItemsForRole(role?: string | null) {
  const r = (role || '').toLowerCase()
  if (r === 'accountant') {
    return [
      { to: '/', label: 'Главная', icon: 'hub', end: true },
      { to: '/workspace/queues', label: 'Очереди', icon: 'all_inbox', end: true },
      { to: '/bank', label: 'Банк', icon: 'account_balance' },
      { to: '/counterparties', label: 'Контрагенты', icon: 'handshake', end: true },
    ]
  }
  if (r === 'manager') {
    return [
      { to: '/', label: 'Главная', icon: 'hub', end: true },
      { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
      { to: '/planner', label: 'Задачи', icon: 'task_alt' },
    ]
  }
  return MOBILE_BAR_ITEMS
}

function pathInZone(pathname: string, zoneId: ZoneId): boolean {
  if (zoneId === 'today') {
    return pathname === '/' || pathname.startsWith('/operations') || pathname.startsWith('/inbox') || pathname.startsWith('/approvals')
  }
  if (zoneId === 'money') {
    return (
      pathname.startsWith('/accounting/journal') ||
      pathname.startsWith('/accounting/fixed-assets') ||
      pathname.startsWith('/bank') ||
      pathname.startsWith('/documents') ||
      pathname.startsWith('/scan')
    )
  }
  if (zoneId === 'reporting') return pathname.startsWith('/reports') || pathname.startsWith('/calendar') || pathname.startsWith('/planner')
  if (zoneId === 'team') return pathname.startsWith('/employees')
  if (zoneId === 'clients') return pathname.startsWith('/counterparties') || pathname.startsWith('/workspace')
  return (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/assistant') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/accounting/chart') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/control') ||
    pathname.startsWith('/notes')
  )
}

export function getActiveZone(pathname: string): ZoneId {
  for (const z of ZONES) {
    if (pathInZone(pathname, z.id)) return z.id
  }
  if (pathname.startsWith('/accounting')) return 'money'
  return 'today'
}

export type ZoneTab = { to: string; label: string; end?: boolean }

export function getZoneTabs(pathname: string, role?: string | null): ZoneTab[] {
  const zone = getActiveZone(pathname)
  const group = getNavGroupsForRole(role).find((g) => g.id === zone)
  if (!group) return []
  return group.items.map((item) => ({ to: item.to, label: item.label, end: item.end ?? true }))
}

export function getZonesForRole(role?: string | null): ZoneMeta[] {
  const allowed = new Set(getNavGroupsForRole(role).map((g) => g.id))
  return ZONES.filter((z) => allowed.has(z.id))
}

export function getActiveZoneGroup(role?: string | null, pathname?: string): NavGroup | undefined {
  if (!pathname) return undefined
  return getNavGroupsForRole(role).find((g) => g.id === getActiveZone(pathname))
}

/** Зоны, где подменю в сайдбаре не показываем — достаточно клика по разделу. */
const ZONES_WITHOUT_SIDEBAR_SUBNAV: Set<ZoneId> = new Set(['today', 'money', 'team', 'clients'])

export function shouldShowZoneSubnav(zoneId: ZoneId): boolean {
  return !ZONES_WITHOUT_SIDEBAR_SUBNAV.has(zoneId)
}
