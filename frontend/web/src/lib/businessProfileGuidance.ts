/** Подсказки и пресеты по типу бизнеса — MVP без общей системы. */

import {
  normalizeLegalForm,
  resolveProductContour,
  taxModesForLegalForm,
  type LegalFormId,
} from './productContour'

export type BusinessGuidance = {
  accountingMode: 'simple' | 'advanced' | 'lightweight'
  hint: string
  suggestedTax?: string
  workflowHint: string
  contourLabel: string
}

const HINTS: Record<LegalFormId, { hint: string; workflowHint: string }> = {
  ip: {
    hint: 'ИП: единый налог — упрощённый учёт без КУДиР.',
    workflowHint: 'Фиксируйте доходы и сдавайте отчётность по срокам.',
  },
  ooo: {
    hint: 'ООО: УСН и ведение КУДиР — журнал доходов и расходов, налоги и отчёты.',
    workflowHint: 'ОКЭД влияет на подсказки OCR и шаблоны операций.',
  },
  odo: {
    hint: 'ОДО: УСН и КУДиР, как у коммерческой организации.',
    workflowHint: 'Проверьте лимиты УСН для выбранного года.',
  },
  chup: {
    hint: 'ЧУП: УСН и КУДиР — учёт доходов и расходов с отчётностью.',
    workflowHint: 'ОКЭД влияет на отраслевые подсказки.',
  },
  kfh: {
    hint: 'КФХ: УСН и КУДиР для учёта деятельности.',
    workflowHint: 'Учёт доходов и сроки отчётности в одном месте.',
  },
  self_employed: {
    hint: 'Самозанятый: лёгкий режим — учёт доходов и чеков.',
    workflowHint: 'Сканируйте чеки и фиксируйте операции.',
  },
}

export function guidanceForLegalForm(form: string, taxRegime?: string): BusinessGuidance {
  const legalForm = normalizeLegalForm(form)
  const modes = taxModesForLegalForm(legalForm)
  const contour = resolveProductContour(legalForm, taxRegime ?? modes[0]?.id)
  const copy = HINTS[legalForm]

  return {
    accountingMode: contour.accountingMode === 'advanced' ? 'advanced' : contour.id === 'lightweight' ? 'lightweight' : 'simple',
    hint: copy.hint,
    suggestedTax: modes[0]?.id,
    workflowHint: copy.workflowHint,
    contourLabel: contour.label,
  }
}
