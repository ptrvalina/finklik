/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_PARTNER_BANK_NAME?: string
  readonly VITE_PARTNER_BANK_BIC?: string
  readonly VITE_PARTNER_BANK_COLOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Ранний override URL API (см. index.html для GitHub Pages / Vercel). */
  __FINKLIK_API_BASE__?: string
}
