/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_PROXY_TARGET: string
  readonly VITE_OAUTH_CLIENT_ID: string
  readonly VITE_OAUTH_CLIENT_SECRET: string
  readonly VITE_OAUTH_SCOPES: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
