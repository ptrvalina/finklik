/** White-label: единственный банк-партнёр платформы. */
export type PartnerBank = {
  name: string
  bic: string
  color: string
  tagline: string
}

export const PARTNER_BANK: PartnerBank = {
  name: import.meta.env.VITE_PARTNER_BANK_NAME || 'Банк ВТБ (ПАО)',
  bic: import.meta.env.VITE_PARTNER_BANK_BIC || 'SLANBY22',
  color: import.meta.env.VITE_PARTNER_BANK_COLOR || '#0066B3',
  tagline: 'Сервис для клиентов банка',
}
