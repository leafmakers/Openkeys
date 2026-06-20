/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: enables the 1500+ Google Fonts browser in the font drawer. */
  readonly VITE_GOOGLE_FONTS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}