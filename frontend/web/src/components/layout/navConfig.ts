/** Execution-first IA — NOW / MONEY / REPORTING / TEAM / CONTROL. */
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
    id: 'now',
    label: 'Сейчас',
    items: [
      {
        to: '/',
        label: 'Главная',
        icon: 'hub',
        end: true,
        description: 'Фокус дня, состояние, следующий шаг',
      },
      {
        to: '/operations',
        label: 'Лента работы',
        icon: 'bolt',
        end: true,
        description: 'Исполнение и приоритеты',
      },
      {
        to: '/inbox',
        label: 'Входящие',
        icon: 'inbox',
        end: true,
        description: 'Запросы и поручения по организации',
      },
      {
        to: '/approvals',
        label: 'Согласования',
        icon: 'approval',
        end: true,
        description: 'Ожидающие подтверждения',
      },
    ],
  },
  {
    id: 'money',
    label: 'Деньги',
    items: [
      {
        to: '/accounting/hub',
        label: 'Учёт',
        icon: 'menu_book',
        end: true,
        description: 'Журнал, банк, документы, план счетов',
        flyout: [
          { to: '/accounting/journal', label: 'Журнал операций' },
          { to: '/bank', label: 'Банк' },
          { to: '/documents', label: 'Документы' },
          { to: '/counterparties', label: 'Контрагенты' },
          { to: '/accounting/chart', label: 'План счетов' },
          { to: '/accounting/fixed-assets', label: 'Основные средства' },
          { to: '/scan', label: 'Сканер' },
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
        description: 'Готовность, блокеры, подача',
        flyout: [
          { to: '/calendar', label: 'Календарь' },
          { to: '/employees', label: 'Кадры и ФСЗН' },
        ],
      },
    ],
  },
  {
    id: 'team',
    label: 'Команда',
    items: [
      {
        to: '/planner',
        label: 'Планёр',
        icon: 'event_note',
        description: 'Задачи и поручения',
      },
      {
        to: '/employees',
        label: 'Сотрудники',
        icon: 'groups',
        description: 'Кадры, зарплата, штат',
      },
    ],
  },
  {
    id: 'control',
    label: 'Контроль',
    items: [
      {
        to: '/control/state',
        label: 'Контроль',
        icon: 'monitoring',
        description: 'Состояние, надёжность, настройки',
        flyout: [
          { to: '/control/state', label: 'Финансовое состояние' },
          { to: '/control/trust', label: 'Надёжность' },
          { to: '/analytics', label: 'Аналитика' },
          { to: '/settings', label: 'Настройки' },
        ],
      },
    ],
  },
]

const MANAGER_ALLOWED = new Set(['/', '/operations', '/scan', '/planner', '/inbox'])

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
  const idx = groups.findIndex((g) => g.id === 'team')
  if (idx < 0) return groups
  const team = groups[idx]
  if (team.items.some((i) => i.to === '/workspace')) return groups
  const wsItems: NavItem[] = [
    {
      to: '/workspace',
      label: 'Клиенты',
      icon: 'corporate_fare',
      description: 'Пространство бухгалтера',
    },
    {
      to: '/workspace/queues',
      label: 'Общие очереди',
      icon: 'all_inbox',
      end: true,
      description: 'Входящие и согласования по всем клиентам',
    },
  ]
  return groups.map((g, i) => (i === idx ? { ...g, items: [...wsItems, ...team.items] } : g))
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

/** Мобильная панель: исполнение и учёт. */
export const MOBILE_BAR_ITEMS = [
  { to: '/', label: 'Главная', icon: 'hub', end: true },
  { to: '/operations', label: 'Лента', icon: 'bolt', end: true },
  { to: '/inbox', label: 'Входящие', icon: 'inbox', end: true },
  { to: '/accounting/hub', label: 'Учёт', icon: 'menu_book' },
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
