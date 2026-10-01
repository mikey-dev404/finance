/// <reference types="vite/client" />

import type { FinanceAPI } from '@shared/api'

interface ImportMetaEnv {
  readonly VITE_FINANCE_PHONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    finance: FinanceAPI
  }
}

export {}
