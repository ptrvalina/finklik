/** Категории журнала согласованы с API (EXPENSE_CATEGORIES + пользовательские ключи). */

export const JOURNAL_CATEGORY_LABELS: Record<string, string> = {
  salary: 'Зарплата',
  rent: 'Аренда',
  materials: 'Материалы',
  marketing: 'Маркетинг',
  taxes: 'Налоги',
  utilities: 'Коммунальные',
  transport: 'Транспорт',
  office: 'Офис',
  services: 'Услуги',
  goods: 'Товары',
  advertising: 'Реклама',
  tax: 'Налоги',
  other: 'Прочее',
}

const KEYWORDS: Record<string, string[]> = {
  rent: ['аренда', 'офис', 'помещение', 'квартира'],
  taxes: ['налог', 'фсзн', 'ндс', 'подоход'],
  marketing: ['реклама', 'ads', 'маркетинг', 'smm'],
  materials: ['товар', 'закупка', 'склад', 'сырьё'],
  salary: ['зарплат', 'оклад', 'премия сотруд'],
  utilities: ['коммунал', 'электро', 'отоплен'],
  transport: ['доставк', 'топлив', 'такси'],
  office: ['канцел', 'офис'],
  services: ['комисс', 'подписк', 'услуг'],
  goods: ['евроопт', 'магазин'],
}

export function suggestJournalCategory(text: string): { category: string; confidence: number } {
  const value = text.toLowerCase()
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some((word) => value.includes(word))) return { category, confidence: 0.84 }
  }
  return { category: 'other', confidence: 0.52 }
}

/** Порядок в селектах и быстром вводе */
export const JOURNAL_CATEGORY_KEYS = [
  'salary',
  'rent',
  'materials',
  'marketing',
  'taxes',
  'utilities',
  'transport',
  'office',
  'services',
  'goods',
  'advertising',
  'tax',
  'other',
] as const
