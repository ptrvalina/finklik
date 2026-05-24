/** Единая навигация Premium OS — группы разделов + сайдбар / мобильный лист. */
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

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

/** Полная карта разделов (IA: Центр управления · Деньги · Люди · Инсайты · Рабочее пространство). */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'command',
    label: 'Центр управления',
    items: [
      {
        to: '/',
        label: 'Главная',
        icon: 'hub',
        end: true,
        description: 'AI, метрики и пульс бизнеса',
      },
      {
        to: '/operations',
        label: 'Лента работы',
        icon: 'bolt',
        end: true,
        description: 'Что требует внимания и следующий шаг',
      },
    ],
  },
  {
    id: 'money',
    label: 'Деньги',
    items: [
      {
        to: '/bank',
        label: 'Банк и поток',
        icon: 'account_balance_wallet',
        description: 'Счета, выписки, ликвидность',
      },
      {
        to: '/accounting',
        label: 'Учёт и КУДиР',
        icon: 'menu_book',
        description: 'Документы, категории, автоматизация',
        flyout: [
          { to: '/accounting/chart', label: 'План счетов' },
          { to: '/accounting/fixed-assets', label: 'ОС и амортизация' },
        ],
      },
      {
        to: '/counterparties',
        label: 'Контрагенты',
        icon: 'handshake',
        description: 'Клиенты и поставщики',
      },
    ],
  },
  {
    id: 'people',
    label: 'Люди',
    items: [
      {
        to: '/employees',
        label: 'Команда и зарплата',
        icon: 'groups',
        description: 'Кадры, табель, найм',
      },
    ],
  },
  {
    id: 'insights',
    label: 'Инсайты',
    items: [
      {
        to: '/reports',
        label: 'Отчётность',
        icon: 'assignment_turned_in',
        description: 'Регламентные и налоговые отчёты',
        flyout: [
          { to: '/analytics', label: 'Аналитика' },
          { to: '/calendar', label: 'Календарь' },
        ],
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Рабочее пространство',
    items: [
      {
        to: '/planner',
        label: 'Планёр',
        icon: 'event_note',
        description: 'Задачи и поручения',
      },
      { to: '/notes', label: 'Заметки', icon: 'note_alt', description: 'Заметки организации' },
      {
        to: '/scan',
        label: 'Скан и OCR',
        icon: 'document_scanner',
        end: true,
        description: 'Документы и распознавание',
      },
      {
        to: '/websites',
        label: 'Сервисы',
        icon: 'language',
        description: 'Полезные ссылки',
      },
    ],
  },
]

const MANAGER_ALLOWED = new Set(['/', '/scan', '/planner'])

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
  const idx = groups.findIndex((g) => g.id === 'command')
  if (idx < 0) return groups
  const cmd = groups[idx]
  if (cmd.items.some((i) => i.to === '/workspace')) return groups
  const wsItem: NavItem = {
    to: '/workspace',
    label: 'Клиенты',
    icon: 'corporate_fare',
    description: 'Мульти-орг и операционные очереди',
  }
  return groups.map((g, i) => (i === idx ? { ...g, items: [wsItem, ...g.items] } : g))
}

/** Группы для сайдбара и мобильного листа с учётом роли. */
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

/** Плоский список пунктов (обратная совместимость, поиск по маршрутам). */
export function getNavItemsForRole(role?: string | null): NavItem[] {
  return getNavGroupsForRole(role).flatMap((g) => g.items)
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

/** Убирает дубликаты маршрутов (например /scan из списка и из хвоста). */
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

/** Консультант вынесен вниз сайдбара (desktop); в списке «Все сервисы» на мобильных добавляется отдельно. */
export const ASSISTANT_SHEET_ITEM = {
  to: '/assistant',
  label: 'Консультант',
  icon: 'smart_toy',
  end: true as const,
  description: 'ИИ-подсказки по учёту',
}

/** Хвост листа: только консультант (скан уже в «Рабочем пространстве»). */
export function flattenNavForSheetWithAssistant(
  items: NavItem[],
): Array<{ to: string; label: string; icon: string; end?: boolean; description?: string }> {
  return dedupeSheet([...flattenNavForSheet(items), ASSISTANT_SHEET_ITEM])
}

type BarItem = { to: string; label: string; icon: string; end?: boolean }

/** Нижняя панель: Обзор · Деньги · Отчёты · Скан + кнопка «Сервисы». */
export const MOBILE_BAR_ITEMS: BarItem[] = [
  { to: '/', label: 'Обзор', icon: 'hub', end: true },
  { to: '/bank', label: 'Деньги', icon: 'payments' },
  { to: '/reports', label: 'Отчёты', icon: 'insights' },
  { to: '/scan', label: 'Скан', icon: 'document_scanner' },
]

export function getMobileBarItemsForRole(role?: string | null): BarItem[] {
  if ((role || '').toLowerCase() !== 'manager') return MOBILE_BAR_ITEMS
  return [
    { to: '/', label: 'Обзор', icon: 'hub', end: true },
    { to: '/scan', label: 'Скан', icon: 'document_scanner', end: true },
    { to: '/planner', label: 'Планёр', icon: 'event_note' },
  ]
}

/** @deprecated используйте NAV_GROUPS / getNavGroupsForRole */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
