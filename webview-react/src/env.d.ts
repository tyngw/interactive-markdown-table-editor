/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly MODE: string
  readonly PROD: boolean
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
