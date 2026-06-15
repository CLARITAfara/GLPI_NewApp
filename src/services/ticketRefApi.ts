// Correspondance Ref_Ticket (CSV) → id de ticket GLPI, persistée dans newapp.db.
// Renseignée à l'import (importApi) et consommée par les imports ultérieurs
// (coûts/mouvements) pour résoudre un Ref vers le vrai id GLPI de façon fiable,
// au lieu de deviner par ordre de création.
const BASE = '/kanban-api'

export interface TicketRef {
  id: number
  ref: number
  glpiTicketId: number
}

/** Enregistre (en remplaçant tout) la correspondance Ref → id GLPI. */
export async function enregistrerRefs(idParRef: Map<string, number>): Promise<void> {
  const corps = [...idParRef].map(([ref, glpiTicketId]) => ({ ref: Number(ref), glpiTicketId }))
  await fetch(`${BASE}/ticket-refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
}

/** Charge la correspondance Ref (1-based) → id GLPI depuis newapp.db. */
export async function chargerRefs(): Promise<Map<number, number>> {
  const res = await fetch(`${BASE}/ticket-refs`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return new Map()
  const data: TicketRef[] = await res.json()
  return new Map(data.map((r) => [r.ref, r.glpiTicketId]))
}

/** Vide la table de correspondance Ref → id GLPI (purge du reset Tickets). */
export async function purgerRefs(): Promise<void> {
  await fetch(`${BASE}/ticket-refs`, { method: 'DELETE' })
}
