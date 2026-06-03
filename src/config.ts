// Configuration lue depuis les variables d'environnement Vite (.env)
export const config = {
  /** Base de l'API (passe par le proxy Vite en dev) */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  /** Client OAuth GLPI */
  oauthClientId: import.meta.env.VITE_OAUTH_CLIENT_ID || '',
  oauthClientSecret: import.meta.env.VITE_OAUTH_CLIENT_SECRET || '',
  /** Scopes demandés au login */
  oauthScopes: import.meta.env.VITE_OAUTH_SCOPES || 'api user email',
}
