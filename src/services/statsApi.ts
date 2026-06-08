// Agrégats du tableau de bord, lus depuis l'API GLPI High-Level (mêmes données
// que celles créées par l'import). Les totaux proviennent de l'en-tête
// Content-Range via `fetchCount` : aucune donnée n'est rapatriée.

import { fetchCount } from './glpiApi'
import { ITEM_TYPES, type ItemType } from './importSchemas'

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
async function compterSur(
  endpoint: string,
  opts: { filter?: string; includeDeleted?: boolean } = {},
): Promise<number> {
  try {
    return await fetchCount(endpoint, opts)
  } catch {
    return 0
  }
}

// ── Éléments (parc) ────────────────────────────────────────────────────────
// La liste des types comptés est dérivée de ITEM_TYPES (source unique partagée
// avec l'import et le reset) : tout type importable est donc compté ici, et
// masqué s'il est à 0.
const TYPES_ELEMENT = (Object.keys(ITEM_TYPES) as ItemType[]).map((t) => ITEM_TYPES[t])

/** Nombre total d'éléments (tous types matériels), ventilé par type. */
export async function getElementStats(): Promise<StatGroup> {
  const parType = await Promise.all(
    TYPES_ELEMENT.map(async (t) => ({
      key: t.assetEndpoint,
      label: t.libelle,
      icon: t.icone,
      // Socket n'a pas de corbeille : on omet le filtre is_deleted (sinon 0).
      total: await compterSur(t.assetEndpoint, { includeDeleted: t.sansCorbeille }),
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
    ...TYPES_TICKET.map((t) => compterSur('/Assistance/Ticket', { filter: `type==${t.code}` })),
  ])

  const parType: TypeCount[] = TYPES_TICKET
    .map((t, i) => ({ key: String(t.code), label: t.label, icon: t.icon, total: comptes[i] }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)

  return { total, parType }
}
