import type { StoredTokens, TokenResponse } from './types'

const STORAGE_KEY = 'glpi_tokens'

/** Enregistre les tokens reçus du endpoint /token */
export function saveTokens(token: TokenResponse): void {
  const stored: StoredTokens = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

/** Récupère les tokens persistés, ou null */
export function getTokens(): StoredTokens | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredTokens
  } catch {
    return null
  }
}

/** Supprime les tokens (déconnexion) */
export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY)
}
