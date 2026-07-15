/** White-label: единственный банк-партнёр платформы. */
export type PartnerBank = {
  name: string
  bic: string
  color: string
  tagline: string
}

export const PARTNER_BANK: PartnerBank = {
  name: import.meta.env.VITE_PARTNER_BANK_NAME || 'Расчётный счёт РБ',
  bic: import.meta.env.VITE_PARTNER_BANK_BIC || 'NBRBBY2X',
  color: import.meta.env.VITE_PARTNER_BANK_COLOR || '#0058be',
  tagline: 'Импорт выписки · пилот FinKlik',
}
