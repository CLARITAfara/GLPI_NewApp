import { config } from '../config'

const STORAGE_KEY = 'glpi_front_tokens'

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

let tokens: Tokens | null = loadFromStorage()

function loadFromStorage(): Tokens | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

function persist(t: Tokens) {
  tokens = t
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t)) } catch {}
}

function clear() {
  tokens = null
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

async function fetchOAuthToken(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${config.apiBaseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Session front : erreur OAuth (${res.status})`)
  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

// Évite les initialisations parallèles
let initPromise: Promise<void> | null = null

/** Initialise (ou renouvelle) la session front. Idempotent et thread-safe. */
export async function initFrontSession(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = _init().finally(() => { initPromise = null })
  return initPromise
}

async function _init(): Promise<void> {
  if (tokens && tokens.expiresAt > Date.now() + 30_000) return

  if (tokens?.refreshToken) {
    try {
      persist(await fetchOAuthToken({
        grant_type: 'refresh_token',
        client_id: config.oauthClientId,
        client_secret: config.oauthClientSecret,
        refresh_token: tokens.refreshToken,
        scope: config.oauthScopes,
      }))
      return
    } catch {
      clear()
    }
  }

  persist(await fetchOAuthToken({
    grant_type: 'password',
    client_id: config.oauthClientId,
    client_secret: config.oauthClientSecret,
    username: config.glpiUsername,
    password: config.glpiPassword,
    scope: config.oauthScopes,
  }))
}

/** fetch authentifié pour le front-office — indépendant du AuthContext. */
export async function frontApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (): Promise<Response> => {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (tokens) headers.set('Authorization', `Bearer ${tokens.accessToken}`)
    return fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  }

  let res = await doFetch()
  if (res.status === 401) {
    clear()
    try {
      await initFrontSession()
      res = await doFetch()
    } catch { /* conserver la réponse 401 */ }
  }
  return res
}
