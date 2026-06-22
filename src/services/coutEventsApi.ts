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
