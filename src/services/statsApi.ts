// Agrégats du tableau de bord, lus depuis l'API GLPI High-Level (mêmes données
// que celles créées par l'import). Les totaux proviennent de l'en-tête
// Content-Range via `fetchCount` : aucune donnée n'est rapatriée.

import { fetchCount } from './glpiApi'

/** Détail d'un type au sein d'une catégorie (un type d'élément, un type de ticket…). */
export interface TypeCount {
  key: string
  label: string
  icon: string
  total: number
}

/** Total général d'une catégorie + sa ventilation par type. */
export interface StatGroup {
  total: number
  parType: TypeCount[]
}

/** Compte sans jamais lever : un type indisponible/désactivé vaut 0. */
async function compterSur(endpoint: string, filter?: string): Promise<number> {
  try {
    return await fetchCount(endpoint, filter ? { filter } : {})
  } catch {
    return 0
  }
}

// ── Éléments (parc) ────────────────────────────────────────────────────────
// Chaque type d'élément est une ressource distincte de l'API GLPI High-Level.
// L'import gère Computer et Monitor ; les autres types sont interrogés au cas
// où ils contiennent des données, et masqués s'ils sont à 0.
const TYPES_ELEMENT: { label: string; icon: string; endpoint: string }[] = [
  { label: 'Ordinateurs',        icon: '💻', endpoint: '/Assets/Computer' },
  { label: 'Moniteurs',          icon: '🖥️', endpoint: '/Assets/Monitor' },
  { label: 'Équipements réseau', icon: '🌐', endpoint: '/Assets/NetworkEquipment' },
  { label: 'Imprimantes',        icon: '🖨️', endpoint: '/Assets/Printer' },
  { label: 'Téléphones',         icon: '📞', endpoint: '/Assets/Phone' },
  { label: 'Périphériques',      icon: '🖱️', endpoint: '/Assets/Peripheral' },
]

/** Nombre total d'éléments, ventilé par type d'élément. */
export async function getElementStats(): Promise<StatGroup> {
  const parType = await Promise.all(
    TYPES_ELEMENT.map(async (t) => ({
      key: t.endpoint,
      label: t.label,
      icon: t.icon,
      total: await compterSur(t.endpoint),
    })),
  )
  const total = parType.reduce((sum, t) => sum + t.total, 0)
  return {
    total,
    parType: parType.filter((t) => t.total > 0).sort((a, b) => b.total - a.total),
  }
}

// ── Tickets ────────────────────────────────────────────────────────────────
// GLPI code le type de ticket : 1 = Incident, 2 = Demande.
const TYPES_TICKET: { label: string; icon: string; code: number }[] = [
  { label: 'Incidents', icon: '🔧', code: 1 },
  { label: 'Demandes',  icon: '📨', code: 2 },
]

/** Nombre total de tickets, ventilé par type (Incident, Demande). */
export async function getTicketStats(): Promise<StatGroup> {
  const [total, ...comptes] = await Promise.all([
    compterSur('/Assistance/Ticket'),
    ...TYPES_TICKET.map((t) => compterSur('/Assistance/Ticket', `type==${t.code}`)),
  ])

  const parType: TypeCount[] = TYPES_TICKET
    .map((t, i) => ({ key: String(t.code), label: t.label, icon: t.icon, total: comptes[i] }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)

  return { total, parType }
}
