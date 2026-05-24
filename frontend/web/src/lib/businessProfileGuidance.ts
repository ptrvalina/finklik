/** Подсказки и пресеты по типу бизнеса (без смены визуального дизайна). */

export type LegalFormId = 'ip' | 'ooo' | 'odo' | 'chup' | 'self_employed'

export type BusinessGuidance = {
  accountingMode: 'simple' | 'advanced' | 'lightweight'
  hint: string
  suggestedTax?: string
  workflowHint: string
}

const GUIDANCE: Record<LegalFormId, BusinessGuidance> = {
  ip: {
    accountingMode: 'simple',
    hint: 'ИП: упрощённый учёт, фокус на доходах и расходах, минимум проводок.',
    suggestedTax: 'usn_no_vat',
    workflowHint: 'Рекомендуем УСН без НДС, если нет обязанности по НДС.',
  },
  ooo: {
    accountingMode: 'advanced',
    hint: 'ООО: полный бухучёт, план счетов, закрытие периода, отчётность.',
    suggestedTax: 'osn_vat',
    workflowHint: 'Обычно общая система или УСН с НДС — уточните у бухгалтера.',
  },
  odo: {
    accountingMode: 'advanced',
    hint: 'ОДО: как ООО — структурированный учёт и контроль оборотов.',
    suggestedTax: 'usn_vat',
    workflowHint: 'Проверьте лимиты для выбранного режима налогообложения.',
  },
  chup: {
    accountingMode: 'advanced',
    hint: 'ЧУП: учёт как у коммерческой организации с отчётностью.',
    suggestedTax: 'usn_vat',
    workflowHint: 'ОКЭД влияет на отраслевые проводки и шаблоны OCR.',
  },
  self_employed: {
    accountingMode: 'lightweight',
    hint: 'Самозанятый: лёгкий режим — учёт доходов и чеков, без полного плана счетов.',
    suggestedTax: 'usn_no_vat',
    workflowHint: 'Сканируйте чеки и фиксируйте операции — отчётность упрощена.',
  },
}

export function guidanceForLegalForm(form: string): BusinessGuidance {
  return GUIDANCE[(form as LegalFormId) in GUIDANCE ? (form as LegalFormId) : 'ip']
}
