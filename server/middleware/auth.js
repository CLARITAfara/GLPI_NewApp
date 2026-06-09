const ADMIN_PROFILES = ['Super-Admin', 'Admin', 'Supervisor']

// URL directe de GLPI (même cible que le proxy Vite, côté serveur).
const GLPI_URL = process.env.GLPI_API_BASE_URL || 'https://localhost/glpi/public'

/**
 * Valide le token Bearer GLPI et vérifie que le profil actif est admin.
 * Retourne 401 si le token est absent/invalide, 403 si le profil est insuffisant.
 */
export async function requireBackofficeAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant.' })
  }

  const token = authHeader.slice(7)

  try {
    const glpiRes = await fetch(`${GLPI_URL}/api.php/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!glpiRes.ok) {
      return res.status(401).json({ error: 'Token invalide ou expiré.' })
    }

    const session = await glpiRes.json()
    const profileName = session?.active_profile?.name ?? ''

    if (!ADMIN_PROFILES.includes(profileName)) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' })
    }

    next()
  } catch {
    return res.status(503).json({ error: 'Impossible de vérifier les droits auprès de GLPI.' })
  }
}
