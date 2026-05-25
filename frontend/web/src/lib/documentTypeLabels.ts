/** Подписи типов первичных документов (значения API без изменений). */
export const PRIMARY_DOC_TYPE_OPTIONS = [
  { value: 'invoice', label: 'Счёт' },
  { value: 'act', label: 'Акт' },
  { value: 'waybill', label: 'Накладная' },
] as const

export function primaryDocTypeLabel(value: string): string {
  return PRIMARY_DOC_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}
