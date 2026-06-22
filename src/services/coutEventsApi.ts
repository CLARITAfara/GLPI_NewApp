// Historique des operations de cout (supercosts + reouvertures), source de
// verite cote backend. Permet de lister et de modifier une operation ; le
// backend recalcule l'agregat (ticket_fixed_costs) par rejeu apres chaque modif.
const BASE = '/kanban-api'

export type TypeEvent = 'COST' | 'REOPEN'

export interface CoutEvent {
  id: number
  ticketId: number
  type: TypeEvent
  montant: number
  pourcentage: number
  modeCalcul: number
  ordre: number
  annule: boolean
  createdAt: string
}

/** Charge tout l'historique des events, ordonne par ticket puis par ordre. */
export async function chargerEvents(): Promise<CoutEvent[]> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events`, {
    headers: { Accept: 'application/json' },
    // Jamais servi depuis le cache HTTP : on veut l'etat recalcule le plus recent.
    cache: 'no-store',
  })
  if (!reponse.ok) return []
  return reponse.json() as Promise<CoutEvent[]>
}

/** Modifie un supercost (montant). Le backend recalcule le ticket. */
export async function modifierSupercost(eventId: number, montant: number): Promise<void> {
  await envoyerModif(eventId, { montant })
}

/** Modifie une reouverture (pourcentage + mode). Le backend recalcule le ticket. */
export async function modifierReouverture(
  eventId: number,
  pourcentage: number,
  modeCalcul: number,
): Promise<void> {
  await envoyerModif(eventId, { pourcentage, modeCalcul })
}

/** Lit le plafond de réouverture (% du supercost). null = aucun plafond. */
export async function chargerPlafond(): Promise<number | null> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/plafond`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!reponse.ok) return null
  const data = (await reponse.json()) as { plafond: number | null }
  return data.plafond
}

/**
 * Définit (ou supprime si null) le plafond de réouverture en %. Le backend
 * recalcule tous les tickets pour appliquer le plafond de façon rétroactive.
 */
export async function definirPlafond(valeur: number | null): Promise<void> {
  const query = valeur === null ? '' : `?valeur=${valeur}`
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/plafond${query}`, { method: 'PUT' })
  if (!reponse.ok) throw new Error(`kanban-api ${reponse.status}`)
}

/** Retablit un mouvement annule. Le backend recalcule le ticket. */
export async function restaurerEvent(eventId: number): Promise<void> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events/${eventId}/restore`, {
    method: 'POST',
  })
  if (!reponse.ok) throw new Error(`kanban-api ${reponse.status}`)
}

async function envoyerModif(
  eventId: number,
  corps: { montant?: number; pourcentage?: number; modeCalcul?: number },
): Promise<void> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!reponse.ok) throw new Error(`kanban-api ${reponse.status}`)
}
