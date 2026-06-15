// Mouvements (changements de statut) regroupés par type de matériel.
// Réutilise l'historique de statut (glpi_logs) + les liens Item_Ticket.
import { getSousItemsLegacy } from './legacyApi'
import { listerTicketsFront } from './ticketsFrontApi'
import { getHistoriqueStatut } from './ticketsApi'
import { pool } from './concurrency'
import { TYPES_MATERIEL } from './coutsApi'

export interface MouvementMateriel {
  ticketId: number
  date: string
  auteur: string
  de: string   // colonne de départ ('Création' si premier statut)
  vers: string // colonne d'arrivée
}

// Statut GLPI → colonne Kanban (1 Nouveau · 2/3/4/10 In progress · 5/6 Terminé).
const COLONNE: Record<number, string> = {
  1: 'Nouveau', 2: 'In progress', 3: 'In progress', 4: 'In progress', 10: 'In progress',
  5: 'Terminé', 6: 'Terminé',
}
const libelle = (id?: number): string => (id ? (COLONNE[id] ?? `Statut ${id}`) : '')

/** Mouvements de statut de tous les tickets, regroupés par itemtype de matériel. */
export async function chargerMvtParMateriel(): Promise<Record<string, MouvementMateriel[]>> {
  const out: Record<string, MouvementMateriel[]> = {}
  for (const t of TYPES_MATERIEL) out[t.itemtype] = []

  const tickets = await listerTicketsFront()
  await pool(tickets, 6, async (ticket) => {
    try {
      const liens = await getSousItemsLegacy('Ticket', ticket.id, 'Item_Ticket')
      const types = [...new Set(liens.map((l) => String(l.itemtype ?? '')))].filter((it) => out[it])
      if (types.length === 0) return

      const hist = await getHistoriqueStatut(ticket.id)
      for (const c of hist) {
        const de = libelle(c.ancien)
        const vers = libelle(c.nouveau)
        if (!vers || de === vers) continue // on ignore le bruit (même colonne)
        for (const it of types) {
          out[it].push({ ticketId: ticket.id, date: c.date, auteur: c.auteur, de: de || 'Création', vers })
        }
      }
    } catch { /* best-effort : un ticket en erreur ne casse pas l'agrégat */ }
  })

  // Plus récents en premier, par type.
  for (const it of Object.keys(out)) {
    out[it].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
  return out
}
