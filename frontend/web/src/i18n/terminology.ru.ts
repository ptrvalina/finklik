/**
 * Единая русская терминология FinClick (Financial OS).
 * Использовать в навигации, execution-слое, отчётности и ошибках.
 */
export const terminology = {
  productName: 'ФинКлик',

  nav: {
    home: 'Главная',
    executionFeed: 'Лента работы',
    workspace: 'Клиенты',
    reports: 'Отчётность',
    accounting: 'Учёт',
    employees: 'Сотрудники',
    bank: 'Банк',
    scan: 'Скан и OCR',
    planner: 'Планёр',
    settings: 'Настройки',
    analytics: 'Аналитика',
    calendar: 'Календарь',
    chartOfAccounts: 'План счетов',
  },

  globalStatus: {
    ok: 'Норма',
    attention: 'Нужны действия',
    risk: 'Есть риск',
    critical: 'Критично',
  },

  execution: {
    financialState: 'Состояние бизнеса',
    workPack: 'Пакет задач',
    trustSurface: 'Надёжность системы',
    reportingReadiness: 'Готовность отчётности',
    operationalIssues: 'Требует внимания',
    aiSuggestion: 'Подсказка системы',
    nextStep: 'Следующий шаг',
  },

  accounting: {
    journal: 'Журнал',
    debit: 'Дебет',
    credit: 'Кредит',
    subaccount: 'Субсчёт',
    offBalance: 'Забалансовый счёт',
    fixedAsset: 'Основное средство',
    intangibleAsset: 'НМА',
    amortization: 'Амортизация',
    chartStandard: 'Приказ Минфина РБ №50',
    balanceActive: 'активный',
    balancePassive: 'пассивный',
    balanceActivePassive: 'активно-пассивный',
  },

  onboarding: {
    businessActivity: 'Чем занимается ваш бизнес?',
    primaryOked: 'Основной ОКЭД',
    secondaryOked: 'Дополнительные ОКЭД',
    taxMode: 'Система налогообложения',
    hasEmployees: 'Есть сотрудники?',
  },
} as const

export type Terminology = typeof terminology
