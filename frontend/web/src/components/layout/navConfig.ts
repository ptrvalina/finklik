/** Business-first IA — СЕГОДНЯ / ДЕНЬГИ / ОТЧЁТНОСТЬ / КОМАНДА / НАСТРОЙКИ. */

export type ZoneId = 'today' | 'money' | 'reporting' | 'team' | 'settings'

export type ZoneMeta = {
  id: ZoneId
  label: string
  icon: string
  /** Первый маршрут зоны — при клике на зону в sidebar. */
  defaultTo: string
}

export const ZONES: ZoneMeta[] = [
  { id: 'today', label: 'Сегодня', icon: 'hub', defaultTo: '/' },
  { id: 'money', label: 'Деньги', icon: 'payments', defaultTo: '/accounting/journal' },
  { id: 'reporting', label: 'Отчётность', icon: 'assignment_turned_in', defaultTo: '/reports' },
  { id: 'team', label: 'Команда', icon: 'groups', defaultTo: '/employees' },
  { id: 'settings', label: 'Настройки', icon: 'settings', defaultTo: '/settings' },
]

export type NavFlyoutItem = { to: string; label: string }

export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  description?: string
  flyout?: NavFlyoutItem[]
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'today',
    label: 'Сегодня',
    items: [
      {
        to: '/',
        label: 'Главная',
        icon: 'hub',
        end: true,
        description: 'Деньги, риск, следующий шаг',
      },
      {
        to: '/inbox',
        label: 'Очередь',
        icon: 'inbox',
        end: true,
        description: 'Входящие и согласования',
      },
      {
        to: '/operations',
        label: 'Все задачи',
        icon: 'bolt',
        end: true,
        description: 'Полная лента исполнения',
      },
    ],
  },
  {
    id: 'money',
    label: 'Деньги',
    items: [
      {
        to: '/accounting/journal',
        label: 'Журнал',
        icon: 'menu_book',
        end: true,
        description: 'Операции и проводки',
        flyout: [
          { to: '/bank', label: 'Банк' },
          { to: '/scan', label: 'Сканер' },
          { to: '/documents', label: 'Документы' },
          { to: '/counterparties', label: 'Контрагенты' },
          { to: '/accounting/fixed-assets', label: 'Основные средства' },
        ],
      },
    ],
  },
  {
    id: 'reporting',
    label: 'Отчётность',
    items: [
      {
        to: '/reports',
        label: 'Отчёты',
        icon: 'assignment_turned_in',
        description: 'Готовность и подача',
        flyout: [{ to: '/calendar', label: 'Календарь' }],
      },
    ],
  },
  {
    id: 'team',
    label: 'Команда',
    items: [
      {
        to: '/employees',
        label: 'Сотрудники',
        icon: 'badge',
        description: 'Кадры, зарплата, ФСЗН',
      },
      {
        to: '/planner',
        label: 'Планёр',
        icon: 'event_note',
        description: 'Задачи и поручения',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    items: [
      {
        to: '/settings',
        label: 'Настройки',
        icon: 'settings',
        end: true,
        description: 'Профиль, интеграции, команда',
        flyout: [
          { to: '/accounting/chart', label: 'План счетов' },
          { to: '/analytics', label: 'Аналитика' },
          { to: '/assistant', label: 'Консультант' },
        ],
      },
    ],
  },
]

const MANAGER_ALLOWED = new Set(['/', '/inbox', '/operations', '/scan', '/planner'])

function filterNavGroups(groups: NavGroup[], allowed: Set<string>): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => allowed.has(i.to) || (i.flyout?.some((f) => allowed.has(f.to)) ?? false),
      ),
    }))
    .filter((g) => g.items.length > 0)
}

function augmentWorkspaceNav(groups: NavGroup[]): NavGroup[] {
  const idx = groups.findIndex((g) => g.id === 'today')
  if (idx < 0) return groups
  const today = groups[idx]
  if (today.items.some((i) => i.to === '/workspace/queues')) return groups
  const wsItems: NavItem[] = [
    {
      to: '/workspace/queues',
      label: 'Очереди клиентов',
      icon: 'all_inbox',
      end: true,
      description: 'Сроки, OCR, входящие по всем организациям',
    },
    {
      to: '/workspace',
      label: 'Клиенты',
      icon: 'corporate_fare',
      description: 'Переключение организаций',
    },
  ]
  return groups.map((g, i) => (i === idx ? { ...g, items: [...wsItems, ...today.items] } : g))
}

export function getNavGroupsForRole(role?: string | null): NavGroup[] {
  const r = (role || '').toLowerCase()
  if (r === 'manager') {
    return filterNavGroups(NAV_GROUPS, MANAGER_ALLOWED)
  }
  if (r === 'accountant' || r === 'owner') {
    return augmentWorkspaceNav(NAV_GROUPS)
  }
  if (r === 'viewer') {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.to !== '/operations'),
    })).filter((g) => g.items.length > 0)
  }
  return NAV_GROUPS
}

export function getNavItemsForRole(role?: string | null): NavItem[] {
  return getNavGroupsForRole(role).flatMap((g) => g.items)
}

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

function dedupeSheet(
  rows: Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }>,
) {
  const seen = new Set<string>()
  return rows.filter((r) => {
    if (seen.has(r.to)) return false
    seen.add(r.to)
    return true
  })
}

export const ASSISTANT_SHEET_ITEM = {
  to: '/assistant',
  label: 'Консультант',
  icon: 'smart_toy',
  end: true as const,
  description: 'Помощь по учёту и отчётности',
}

export function flattenNavForSheetWithAssistant(
  items: NavItem[],
): Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }> {
  return dedupeSheet([...flattenNavForSheet(items), ASSISTANT_SHEET_ITEM])
}

export const MOBILE_BAR_ITEMS = [
  { to: '/', label: 'Сегодня', icon: 'hub', end: true },
  { to: '/accounting/journal', label: 'Деньги', icon: 'menu_book' },
  { to: '/reports', label: 'Отчёты', icon: 'assignment_turned_in' },
  { to: '/inbox', label: 'Очередь', icon: 'inbox', end: true },
]

export function getMobileBarItemsForRole(role?: string | null) {
  const r = (role || '').toLowerCase()
  if (r === 'accountant') {
    return [
      { to: '/workspace/queues', label: 'Очереди', icon: 'all_inbox', end: true },
      { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
      { to: '/accounting/journal', label: 'Журнал', icon: 'menu_book' },
    ]
  }
  if (r === 'manager') {
    return [
      { to: '/', label: 'Сегодня', icon: 'hub', end: true },
      { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
      { to: '/planner', label: 'Планёр', icon: 'event_note' },
    ]
  }
  return MOBILE_BAR_ITEMS
}

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

function pathInZone(pathname: string, zoneId: ZoneId): boolean {
  if (zoneId === 'today') {
    return (
      pathname === '/' ||
      pathname.startsWith('/operations') ||
      pathname.startsWith('/inbox') ||
      pathname.startsWith('/approvals')
    )
  }
  if (zoneId === 'money') {
    return (
      pathname.startsWith('/accounting') ||
      pathname.startsWith('/bank') ||
      pathname.startsWith('/documents') ||
      pathname.startsWith('/counterparties') ||
      pathname.startsWith('/scan')
    )
  }
  if (zoneId === 'reporting') {
    return pathname.startsWith('/reports') || pathname.startsWith('/calendar')
  }
  if (zoneId === 'team') {
    return pathname.startsWith('/planner') || pathname.startsWith('/workspace') || pathname.startsWith('/employees')
  }
  return (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/assistant') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/control') ||
    pathname.startsWith('/notes')
  )
}

export function getActiveZone(pathname: string): ZoneId {
  for (const z of ZONES) {
    if (pathInZone(pathname, z.id)) return z.id
  }
  return 'today'
}

export type ZoneTab = { to: string; label: string; end?: boolean }

export function getZoneTabs(pathname: string, role?: string | null): ZoneTab[] {
  const zone = getActiveZone(pathname)
  const groups = getNavGroupsForRole(role)
  const group = groups.find((g) => g.id === zone)
  if (!group) return []

  const tabs: ZoneTab[] = []
  for (const item of group.items) {
    if (item.flyout?.length) {
      tabs.push({ to: item.to, label: item.label, end: true })
      for (const c of item.flyout) {
        tabs.push({ to: c.to, label: c.label, end: true })
      }
    } else {
      tabs.push({ to: item.to, label: item.label, end: item.end })
    }
  }
  const seen = new Set<string>()
  return tabs.filter((t) => {
    if (seen.has(t.to)) return false
    seen.add(t.to)
    return true
  })
}

export function getZonesForRole(role?: string | null): ZoneMeta[] {
  const groups = getNavGroupsForRole(role)
  const allowed = new Set(groups.map((g) => g.id))
  return ZONES.filter((z) => allowed.has(z.id))
}
