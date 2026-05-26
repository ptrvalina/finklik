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
    financialStateShort: 'Финансовое состояние',
    processSummary: 'Сводка процессов',
    workPack: 'Пакет задач',
    trustSurface: 'Надёжность системы',
    reportingReadiness: 'Готовность отчётности',
    operationalIssues: 'Требует внимания',
    aiSuggestion: 'Подсказка системы',
    nextStep: 'Следующий шаг',
    executionFeed: 'Лента работы',
    compliance: 'Комплаенс',
  },

  trust: {
    calmIndicators: 'Спокойные индикаторы',
    backgroundJobs: 'Фоновые процессы',
    consistency: 'Согласованность',
    safeActions: 'Безопасные действия',
    loadTitle: 'Данные недоступны',
    loadFallback: 'Не удалось загрузить показатели надёжности. Повторите позже.',
    automationProfile: 'Профиль автоматизации',
    aiBaseMode: 'базовый режим ИИ',
    alwaysConfirm: 'Всегда с подтверждением',
  },

  reporting: {
    obligations: 'Обязательства и календарь',
    submitFailed: 'Не удалось отправить отчёт — проверьте данные и повторите.',
    downloadFailed: 'Не удалось скачать файл — попробуйте ещё раз.',
    actionFailed: 'Не удалось выполнить действие — данные на сервере сохранены.',
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
