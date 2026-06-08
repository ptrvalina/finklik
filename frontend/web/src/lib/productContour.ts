/**
 * Адаптивный контур FinKlik — MVP: без общей системы налогообложения.
 * ООО/ЧУП/КФХ — только УСН + КУДиР; ИП — единый налог.
 */

export type LegalFormId = 'ip' | 'chup' | 'ooo' | 'kfh' | 'odo' | 'self_employed'

export type ProductContourId =
  | 'ip_single_tax'
  | 'org_usn'
  | 'lightweight'

export type ProductFeatures = {
  kudir: boolean
  chartOfAccounts: boolean
  fixedAssets: boolean
  fullLedger: boolean
  singleTax: boolean
  usn: boolean
  incomeTax: boolean
  employees: boolean
  counterparties: boolean
  documents: boolean
  reporting: boolean
}

export type ProductContour = {
  id: ProductContourId
  label: string
  accountingMode: 'simple' | 'advanced'
  features: ProductFeatures
}

const CONTOUR_FEATURES: Record<ProductContourId, ProductFeatures> = {
  ip_single_tax: {
    kudir: false,
    chartOfAccounts: false,
    fixedAssets: false,
    fullLedger: false,
    singleTax: true,
    usn: false,
    incomeTax: false,
    employees: true,
    counterparties: true,
    documents: true,
    reporting: true,
  },
  org_usn: {
    kudir: true,
    chartOfAccounts: false,
    fixedAssets: false,
    fullLedger: false,
    singleTax: false,
    usn: true,
    incomeTax: false,
    employees: true,
    counterparties: true,
    documents: true,
    reporting: true,
  },
  lightweight: {
    kudir: false,
    chartOfAccounts: false,
    fixedAssets: false,
    fullLedger: false,
    singleTax: false,
    usn: true,
    incomeTax: false,
    employees: false,
    counterparties: false,
    documents: true,
    reporting: true,
  },
}

const CONTOUR_META: Record<ProductContourId, { label: string; accountingMode: 'simple' | 'advanced' }> = {
  ip_single_tax: { label: 'ИП · единый налог', accountingMode: 'simple' },
  org_usn: { label: 'Организация · УСН и КУДиР', accountingMode: 'simple' },
  lightweight: { label: 'Упрощённый режим', accountingMode: 'simple' },
}

/** Допустимые tax_regime по ОПФ — MVP без общей системы. */
export const TAX_MODES_BY_LEGAL_FORM: Record<LegalFormId, { id: string; label: string }[]> = {
  ip: [{ id: 'single_tax', label: 'Единый налог' }],
  chup: [
    { id: 'usn_no_vat', label: 'УСН без НДС' },
    { id: 'usn_vat', label: 'УСН с НДС' },
  ],
  ooo: [
    { id: 'usn_no_vat', label: 'УСН без НДС' },
    { id: 'usn_vat', label: 'УСН с НДС' },
  ],
  kfh: [
    { id: 'usn_no_vat', label: 'УСН без НДС' },
    { id: 'usn_vat', label: 'УСН с НДС' },
  ],
  odo: [
    { id: 'usn_no_vat', label: 'УСН без НДС' },
    { id: 'usn_vat', label: 'УСН с НДС' },
  ],
  self_employed: [{ id: 'usn_no_vat', label: 'Упрощённый учёт' }],
}

export function normalizeLegalForm(raw: string | null | undefined): LegalFormId {
  const v = (raw || 'ip').trim().toLowerCase()
  if (v in TAX_MODES_BY_LEGAL_FORM) return v as LegalFormId
  return 'ip'
}

export function taxModesForLegalForm(form: string): { id: string; label: string }[] {
  return TAX_MODES_BY_LEGAL_FORM[normalizeLegalForm(form)]
}

export function isTaxRegimeValidForForm(legalForm: string, taxRegime: string): boolean {
  const modes = taxModesForLegalForm(legalForm)
  const tax = (taxRegime || '').trim().toLowerCase()
  if (modes.some((m) => m.id === tax)) return true
  // Legacy: ИП usn_no_vat / osn_vat → единый налог; организации osn_vat → УСН
  const form = normalizeLegalForm(legalForm)
  if (form === 'ip' && (tax === 'usn_no_vat' || tax === 'osn_vat')) return true
  if (form !== 'ip' && form !== 'self_employed' && tax === 'osn_vat') return true
  return false
}

export function resolveProductContour(
  legalForm: string | null | undefined,
  taxRegime: string | null | undefined,
): ProductContour {
  const form = normalizeLegalForm(legalForm)
  const tax = (taxRegime || 'usn_no_vat').trim().toLowerCase()

  if (form === 'self_employed') {
    const id: ProductContourId = 'lightweight'
    return { id, ...CONTOUR_META[id], features: CONTOUR_FEATURES[id] }
  }

  if (form === 'ip') {
    const id: ProductContourId = 'ip_single_tax'
    return { id, ...CONTOUR_META[id], features: CONTOUR_FEATURES[id] }
  }

  const id: ProductContourId = 'org_usn'
  return { id, ...CONTOUR_META[id], features: CONTOUR_FEATURES[id] }
}

export function hiddenRoutesForContour(contour: ProductContour): Set<string> {
  const hidden = new Set<string>()
  const f = contour.features

  if (!f.kudir) hidden.add('/accounting/kudir')
  if (!f.chartOfAccounts) hidden.add('/accounting/chart')
  if (!f.fixedAssets) hidden.add('/accounting/fixed-assets')
  if (!f.employees) {
    hidden.add('/employees')
    hidden.add('/employees/list')
  }
  if (!f.counterparties) hidden.add('/counterparties')

  return hidden
}

export function filterRoutes<T extends { to: string }>(items: T[], contour: ProductContour): T[] {
  const hidden = hiddenRoutesForContour(contour)
  return items.filter((i) => !hidden.has(i.to))
}
