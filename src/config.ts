// Configuration lue depuis les variables d'environnement Vite (.env)
export const config = {
  /** Base de l'API GLPI (passe par le proxy Vite en dev) */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  /** Client OAuth GLPI */
  oauthClientId: import.meta.env.VITE_OAUTH_CLIENT_ID || '',
  oauthClientSecret: import.meta.env.VITE_OAUTH_CLIENT_SECRET || '',
  /** Scopes demandés au login */
  oauthScopes: import.meta.env.VITE_OAUTH_SCOPES || 'api user email',
  /** Base de l'API locale (serveur Express Node.js) */
  localApiUrl: import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3001/api',
  /**
   * Jeton API personnel GLPI (Préférences > Clés d'accès distant > Jeton d'API).
   * Requis uniquement pour l'upload d'images en tant que documents, via l'API
   * REST legacy (`/api/v1`) — l'API OAuth ne gère pas l'envoi de fichiers.
   */
  glpiUserToken: import.meta.env.VITE_GLPI_USER_TOKEN || '',
  /** App-Token GLPI (optionnel, selon la configuration du client API). */
  glpiAppToken: import.meta.env.VITE_GLPI_APP_TOKEN || '',
  /** Identifiant GLPI fixe utilisé pour la connexion via code unique */
  glpiUsername: import.meta.env.VITE_GLPI_USERNAME || 'glpi',
  /** Code d'accès par défaut affiché sur le formulaire de connexion */
  glpiPassword: import.meta.env.VITE_GLPI_PASSWORD || 'glpi',
}
