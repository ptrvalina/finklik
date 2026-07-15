export const DOC_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  receipt: { label: 'Чек', icon: 'receipt', color: 'text-secondary' },
  ttn: { label: 'ТТН', icon: 'local_shipping', color: 'text-primary' },
  act: { label: 'Акт', icon: 'task', color: 'text-tertiary' },
  invoice: { label: 'Счёт', icon: 'request_quote', color: 'text-error' },
  payment_order: { label: 'Платёжное поручение', icon: 'payments', color: 'text-primary' },
  kudir: { label: 'КУДиР', icon: 'book', color: 'text-primary' },
  unknown: { label: 'Другое', icon: 'description', color: 'text-on-surface-variant' },
}
