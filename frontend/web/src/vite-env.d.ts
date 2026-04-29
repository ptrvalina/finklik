/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Ранний override URL API (см. index.html для GitHub Pages / Vercel). */
  __FINKLIK_API_BASE__?: string
}
