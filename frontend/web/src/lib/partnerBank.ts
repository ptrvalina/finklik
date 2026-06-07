/** White-label: единственный банк-партнёр платформы. */
export type PartnerBank = {
  name: string
  bic: string
  color: string
  tagline: string
}

export const PARTNER_BANK: PartnerBank = {
  name: import.meta.env.VITE_PARTNER_BANK_NAME || 'Приорбанк',
  bic: import.meta.env.VITE_PARTNER_BANK_BIC || 'PJCBBY2X',
  color: import.meta.env.VITE_PARTNER_BANK_COLOR || '#DC2626',
  tagline: 'Сервис для клиентов банка',
}
