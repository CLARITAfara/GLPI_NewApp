import { config } from '../config'
import type { Session, TokenResponse } from './types'
import { clearTokens, getTokens, saveTokens } from './tokenStore'

// ─── OAuth / GLPI API ────────────────────────────────────────────────────────

/** Appel bas niveau au endpoint OAuth /token */
async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${config.apiBaseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseOAuthError(res))
  }
  return (await res.json()) as TokenResponse
}

const OAUTH_ERROR_FR: Record<string, string> = {
  invalid_grant: 'Identifiant ou mot de passe incorrect.',
  invalid_client: 'Client OAuth invalide (vérifiez VITE_OAUTH_CLIENT_ID / SECRET).',
  invalid_scope: 'Scope OAuth invalide.',
  unauthorized_client: "Ce client OAuth n'autorise pas la connexion par mot de passe.",
  access_denied: 'Accès refusé.',
}

async function parseOAuthError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data?.error && OAUTH_ERROR_FR[data.error]) return OAUTH_ERROR_FR[data.error]
    if (data?.error_description) return String(data.error_description)
    if (data?.error) return String(data.error)
  } catch {
    /* corps non-JSON */
  }
  if (res.status === 400 || res.status === 401) return 'Identifiant ou mot de passe incorrect.'
  return `Erreur serveur (${res.status}).`
}

/** Connexion par identifiant/mot de passe (OAuth password grant) */
export async function login(username: string, password: string): Promise<void> {
  const token = await requestToken({
    grant_type: 'password',
    client_id: config.oauthClientId,
    client_secret: config.oauthClientSecret,
    username,
    password,
    scope: config.oauthScopes,
  })
  saveTokens(token)
}

/** Rafraîchit l'access token. Renvoie true si réussi. */
export async function refresh(): Promise<boolean> {
  const tokens = getTokens()
  if (!tokens) return false
  try {
    const token = await requestToken({
      grant_type: 'refresh_token',
      client_id: config.oauthClientId,
      client_secret: config.oauthClientSecret,
      refresh_token: tokens.refreshToken,
      scope: config.oauthScopes,
    })
    saveTokens(token)
    return true
  } catch {
    clearTokens()
    return false
  }
}

/** Déconnexion (purge locale des tokens) */
export function logout(): void {
  clearTokens()
}

/**
 * fetch authentifié vers l'API GLPI.
 * Rafraîchit automatiquement le token sur une réponse 401.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (): Promise<Response> => {
    const tokens = getTokens()
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (tokens) headers.set('Authorization', `Bearer ${tokens.accessToken}`)
    return fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  }

  let res = await doFetch()
  if (res.status === 401 && (await refresh())) {
    res = await doFetch()
  }
  return res
}

/** Récupère les informations de la session courante */
export async function getSession(): Promise<Session> {
  const res = await apiFetch('/session')
  if (!res.ok) throw new Error('Impossible de récupérer la session.')
  return (await res.json()) as Session
}

// ─── API locale (serveur Express Node.js) ───────────────────────────────────

/**
 * fetch non authentifié vers le serveur Express local.
 * Utilisé par les services qui ciblent l'API locale (SQLite custom).
 */
export async function fetchLocale(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${config.localApiUrl}${path}`, init)
}
