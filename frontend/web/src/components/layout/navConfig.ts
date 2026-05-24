/** Execution-first IA — контекст и задачи, не ERP-меню. */
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
        description: 'Состояние, обязательства, фокус',
      },
      {
        to: '/operations',
        label: 'Лента работы',
        icon: 'bolt',
        end: true,
        description: 'Что сделать и почему — центр продукта',
      },
    ],
  },
  {
    id: 'accounting',
    label: 'Учёт',
    items: [
      {
        to: '/accounting/hub',
        label: 'Учёт',
        icon: 'menu_book',
        end: true,
        description: 'Журнал, документы, банк, план счетов',
        flyout: [
          { to: '/accounting', label: 'Журнал операций' },
          { to: '/scan', label: 'Сканер' },
          { to: '/legacy/documents', label: 'Документы' },
          { to: '/bank', label: 'Банк' },
          { to: '/accounting/chart', label: 'План счетов' },
          { to: '/accounting/fixed-assets', label: 'ОС' },
        ],
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Комплаенс',
    items: [
      {
        to: '/reports',
        label: 'Отчётность',
        icon: 'assignment_turned_in',
        description: 'Готовность, ошибки, подача',
        flyout: [
          { to: '/analytics', label: 'Аналитика' },
          { to: '/calendar', label: 'Календарь' },
        ],
      },
    ],
  },
  {
    id: 'team',
    label: 'Команда',
    items: [
      {
        to: '/employees',
        label: 'Команда',
        icon: 'groups',
        description: 'Кадры, зарплата, ФСЗН',
      },
    ],
  },
  {
    id: 'more',
    label: 'Ещё',
    items: [
      {
        to: '/planner',
        label: 'Планёр',
        icon: 'event_note',
        description: 'Задачи и поручения',
      },
      { to: '/notes', label: 'Заметки', icon: 'note_alt' },
      { to: '/counterparties', label: 'Контрагенты', icon: 'handshake' },
    ],
  },
]

const MANAGER_ALLOWED = new Set(['/', '/operations', '/scan', '/planner'])

function filterNavGroups(groups: NavGroup[], allowed: Set<string>): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          allowed.has(i.to) ||
          (i.flyout?.some((f) => allowed.has(f.to)) ?? false),
      ),
    }))
    .filter((g) => g.items.length > 0)
}

function augmentWorkspaceNav(groups: NavGroup[]): NavGroup[] {
  const idx = groups.findIndex((g) => g.id === 'today')
  if (idx < 0) return groups
  const cmd = groups[idx]
  if (cmd.items.some((i) => i.to === '/workspace')) return groups
  const wsItem: NavItem = {
    to: '/workspace',
    label: 'Клиенты',
    icon: 'corporate_fare',
    description: 'Пространство бухгалтера',
  }
  return groups.map((g, i) => (i === idx ? { ...g, items: [...cmd.items, wsItem] } : g))
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
  description: 'ИИ по учёту и отчётности',
}

export function flattenNavForSheetWithAssistant(
  items: NavItem[],
): Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }> {
  return dedupeSheet([...flattenNavForSheet(items), ASSISTANT_SHEET_ITEM])
}

/** Мобильная панель: фокус на работе, не на банке. */
export const MOBILE_BAR_ITEMS = [
  { to: '/', label: 'Главная', icon: 'hub', end: true },
  { to: '/operations', label: 'Лента', icon: 'bolt', end: true },
  { to: '/accounting/hub', label: 'Учёт', icon: 'menu_book' },
  { to: '/reports', label: 'Отчёты', icon: 'assignment_turned_in' },
]

export function getMobileBarItemsForRole(role?: string | null) {
  if ((role || '').toLowerCase() !== 'manager') return MOBILE_BAR_ITEMS
  return [
    { to: '/', label: 'Главная', icon: 'hub', end: true },
    { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
    { to: '/planner', label: 'Планёр', icon: 'event_note' },
  ]
}

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
