import { getSousItemsLegacy } from './legacyApi'
import { listerTicketsFront } from './ticketsFrontApi'
import { pool } from './concurrency'

const BASE = '/kanban-api'

export const TYPES_MATERIEL: { itemtype: string; libelle: string }[] = [
  { itemtype: 'Computer', libelle: 'PC' },
  { itemtype: 'Monitor', libelle: 'Moniteur' },
  { itemtype: 'Phone', libelle: 'Téléphone' },
]

export async function ajouterCoutFixe(ticketId: number, montant: number): Promise<void> {
  await fetch(`${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/add?montant=${montant}`, { method: 'POST' })
}

export async function annulerDernierCoutFixe(ticketId: number): Promise<void> {
  await fetch(`${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/cancel-last`, { method: 'POST' })
}

export async function appliquerReouverture(ticketId: number, pourcentage: number): Promise<void> {
  await fetch(`${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/reopen?pourcentage=${pourcentage}`, { method: 'POST' })
}

export interface CoutMateriel {
  libelle: string
  coutImport: number
  coutTime: number
  coutManuel: number
  coutReouverture: number
}

interface CoutFixeApi {
  ticketId: number
  coutFixe: number
  pourcentageReouverture: number
  baseReouverture: number
}

export async function chargerCoutsParMateriel(): Promise<CoutMateriel[]> {
  const manuels = await fetch(`${BASE}/ticket-fixed-costs`, { headers: { Accept: 'application/json' } })
    .then((reponse) => (reponse.ok ? (reponse.json() as Promise<CoutFixeApi[]>) : []))
    .catch(() => [] as CoutFixeApi[])
  const coutManuelParTicket = new Map<number, number>()
  const coutReouvertureParTicket = new Map<number, number>()
  for (const manuel of manuels) {
    coutManuelParTicket.set(manuel.ticketId, manuel.coutFixe)
    // Frais recalculés à la volée : base FIGÉE à la réouverture × pourcentage cumulé / 100.
    // (la base n'est pas dernier_cout, qu'une annulation remet à 0 → les frais survivent.)
    const base = manuel.baseReouverture ?? 0
    const pourcentage = manuel.pourcentageReouverture ?? 0
    coutReouvertureParTicket.set(manuel.ticketId, base * (pourcentage / 100))
  }

  const tickets = await listerTicketsFront()
  const totaux = new Map<string, CoutMateriel>(
    TYPES_MATERIEL.map((type) => [type.itemtype, { libelle: type.libelle, coutImport: 0, coutTime: 0, coutManuel: 0, coutReouverture: 0 }]),
  )

  await pool(tickets, 6, async (ticket) => {
    try {
      const liens = await getSousItemsLegacy('Ticket', ticket.id, 'Item_Ticket')
      if (liens.length === 0) return
      const couts = await getSousItemsLegacy('Ticket', ticket.id, 'TicketCost')
      const coutImportTicket = couts.reduce((somme, cout) => somme + (Number(cout.cost_fixed) || 0), 0)
      const coutTimeTicket = couts.reduce((somme, cout) => {
        const dureeSecondes = Number(cout.actiontime) || 0
        const tarifHoraire = Number(cout.cost_time) || 0
        return somme + (dureeSecondes / 3600) * tarifHoraire
      }, 0)
      const partImport = coutImportTicket / liens.length
      const partTime = coutTimeTicket / liens.length
      const partManuel = (coutManuelParTicket.get(ticket.id) ?? 0) / liens.length
      const partReouverture = (coutReouvertureParTicket.get(ticket.id) ?? 0) / liens.length
      for (const lien of liens) {
        const cible = totaux.get(String(lien.itemtype ?? ''))
        if (!cible) continue
        cible.coutImport += partImport
        cible.coutTime += partTime
        cible.coutManuel += partManuel
        cible.coutReouverture += partReouverture
      }
    } catch {
      void 0
    }
  })

  return [...totaux.values()]
}
