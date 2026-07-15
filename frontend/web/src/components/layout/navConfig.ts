/** Business-first IA — Главная / Банк / Учёт / Календарь / Команда / Контрагенты / Настройки. */

import { filterRoutes, hiddenRoutesForContour, type ProductContour } from '../../lib/productContour'

export type ZoneId = 'today' | 'money' | 'reporting' | 'calendar' | 'team' | 'clients' | 'settings'

export type ZoneMeta = {
  id: ZoneId
  label: string
  icon: string
  defaultTo: string
}

export const ZONES: ZoneMeta[] = [
  { id: 'today', label: 'Главная', icon: 'dashboard', defaultTo: '/' },
  { id: 'money', label: 'Банк', icon: 'account_balance', defaultTo: '/bank' },
  { id: 'reporting', label: 'Учёт', icon: 'account_balance_wallet', defaultTo: '/accounting/journal' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar_month', defaultTo: '/calendar' },
  { id: 'team', label: 'Сотрудники', icon: 'groups', defaultTo: '/employees' },
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
      { to: '/scan', label: 'Сканер', icon: 'document_scanner', end: true, description: 'Первичные документы' },
      { to: '/documents', label: 'Документы', icon: 'folder', end: true, description: 'Счета и акты' },
    ],
  },
  {
    id: 'reporting',
    label: 'Учёт',
    items: [
      { to: '/accounting/journal', label: 'Журнал', icon: 'menu_book', end: true, description: 'Доходы и расходы' },
      { to: '/accounting/kudir', label: 'КУДиР', icon: 'book', end: true, description: 'Книга доходов и расходов' },
      { to: '/accounting/taxes', label: 'Налоги', icon: 'calculate', end: true, description: 'УСН, ФСЗН и сроки' },
      { to: '/reports', label: 'Отчёты', icon: 'assignment_turned_in', end: true, description: 'Подготовка и подача' },
    ],
  },
  {
    id: 'calendar',
    label: 'Календарь',
    items: [
      { to: '/calendar', label: 'Календарь', icon: 'event', end: true, description: 'Налоги, зарплата и сроки' },
    ],
  },
  {
    id: 'team',
    label: 'Команда',
    items: [
      { to: '/employees', label: 'Команда', icon: 'groups', end: true, description: 'Приём, табель и кадровые процессы' },
      { to: '/employees/list', label: 'Сотрудники', icon: 'badge', end: true, description: 'Список и личные дела' },
      { to: '/planner', label: 'Задачи', icon: 'task_alt', end: true, description: 'Поручения команде' },
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

function applyContourToNavGroups(groups: NavGroup[], contour?: ProductContour | null): NavGroup[] {
  if (!contour) return groups
  const hidden = hiddenRoutesForContour(contour)
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !hidden.has(i.to)) }))
    .filter((g) => g.items.length > 0)
}

export function getNavGroupsForRole(role?: string | null, contour?: ProductContour | null): NavGroup[] {
  const r = (role || '').toLowerCase()
  if (r === 'manager') return filterNavGroups(NAV_GROUPS, MANAGER_ALLOWED)
  let groups = r === 'accountant' ? augmentClientsNav(NAV_GROUPS) : NAV_GROUPS
  if (r === 'viewer') {
    groups = groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.to !== '/operations') }))
      .filter((g) => g.items.length > 0)
  }
  return applyContourToNavGroups(groups, contour)
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
  { to: '/accounting/journal', label: 'Учёт', icon: 'menu_book', end: true },
  { to: '/counterparties', label: 'Контрагенты', icon: 'handshake', end: true },
]

export function getMobileBarItemsForRole(role?: string | null, contour?: ProductContour | null) {
  const r = (role || '').toLowerCase()
  let items = MOBILE_BAR_ITEMS
  if (r === 'accountant') {
    items = [
      { to: '/', label: 'Главная', icon: 'hub', end: true },
      { to: '/workspace/queues', label: 'Очереди', icon: 'all_inbox', end: true },
      { to: '/accounting/journal', label: 'Учёт', icon: 'menu_book', end: true },
      { to: '/calendar', label: 'Календарь', icon: 'event', end: true },
    ]
  } else if (r === 'manager') {
    items = [
      { to: '/', label: 'Главная', icon: 'hub', end: true },
      { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
      { to: '/planner', label: 'Задачи', icon: 'task_alt' },
    ]
  }
  return contour ? filterRoutes(items, contour) : items
}

function pathInZone(pathname: string, zoneId: ZoneId): boolean {
  if (zoneId === 'today') {
    return pathname === '/' || pathname.startsWith('/operations') || pathname.startsWith('/inbox') || pathname.startsWith('/approvals')
  }
  if (zoneId === 'money') {
    return (
      pathname.startsWith('/accounting/fixed-assets') ||
      pathname.startsWith('/bank') ||
      pathname.startsWith('/documents') ||
      pathname.startsWith('/scan')
    )
  }
  if (zoneId === 'reporting') {
    return (
      pathname === '/accounting' ||
      pathname.startsWith('/accounting/journal') ||
      pathname.startsWith('/accounting/kudir') ||
      pathname.startsWith('/accounting/taxes') ||
      pathname.startsWith('/reports') ||
      pathname.startsWith('/taxes')
    )
  }
  if (zoneId === 'calendar') return pathname.startsWith('/calendar')
  if (zoneId === 'team') return pathname.startsWith('/employees') || pathname.startsWith('/planner')
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
  if (pathname.startsWith('/accounting/fixed-assets')) return 'money'
  return 'today'
}

export type ZoneTab = { to: string; label: string; end?: boolean }

export function getZoneTabs(pathname: string, role?: string | null, contour?: ProductContour | null): ZoneTab[] {
  const zone = getActiveZone(pathname)
  const group = getNavGroupsForRole(role, contour).find((g) => g.id === zone)
  if (!group) return []
  return group.items.map((item) => ({ to: item.to, label: item.label, end: item.end ?? true }))
}

export function getZonesForRole(role?: string | null, contour?: ProductContour | null): ZoneMeta[] {
  const allowed = new Set(getNavGroupsForRole(role, contour).map((g) => g.id))
  return ZONES.filter((z) => allowed.has(z.id))
}

export function getActiveZoneGroup(
  role?: string | null,
  pathname?: string,
  contour?: ProductContour | null,
): NavGroup | undefined {
  if (!pathname) return undefined
  return getNavGroupsForRole(role, contour).find((g) => g.id === getActiveZone(pathname))
}

/** Зоны, где подменю в сайдбаре не показываем — достаточно клика по разделу. */
const ZONES_WITHOUT_SIDEBAR_SUBNAV: Set<ZoneId> = new Set(['today', 'money', 'reporting', 'calendar', 'team', 'clients'])

export function shouldShowZoneSubnav(zoneId: ZoneId): boolean {
  return !ZONES_WITHOUT_SIDEBAR_SUBNAV.has(zoneId)
}
