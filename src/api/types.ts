// Types de l'API GLPI High-Level (sous-ensemble utilisé par l'app)

/** Réponse du endpoint OAuth /token */
export interface TokenResponse {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
}

/** Tokens persistés côté client */
export interface StoredTokens {
  accessToken: string
  refreshToken: string
  /** Epoch (ms) d'expiration de l'access token */
  expiresAt: number
}

/** Profil (rôle) actif de la session */
export interface ActiveProfile {
  id: number
  name: string
  /** "central" = admin/technique, "helpdesk" = libre-service */
  interface: 'central' | 'helpdesk' | string
}

/** Réponse du endpoint /session */
export interface Session {
  user_id: number
  name: string
  friendly_name: string
  real_name: string
  first_name: string
  default_entity: number
  profiles: Record<string, { name: string; entities: { id: number; name: string }[] }>
  active_profile: ActiveProfile
  active_entities: number[]
}
