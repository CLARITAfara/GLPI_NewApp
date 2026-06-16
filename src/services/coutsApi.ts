import { getSousItemsLegacy } from './legacyApi'
import { listerTicketsFront } from './ticketsFrontApi'
import { pool } from './concurrency'

const BASE = '/kanban-api'

// ── Types pour le panneau de détail ──────────────────────────────────────────

/** Une entrée brute de coût GLPI (TicketCost). */
export interface EntreePrix {
  ticketId: number
  nom: string
  date: string
  coutFixe: number
  coutTemps: number
  /** (coutFixe + coutTemps) / N liens du ticket */
  part: number
  /** false si coutFixe = 0 et coutTemps = 0 → entrée annulée */
  actif: boolean
}

/** État agrégé des frais manuels + réouverture d'un ticket (ticket_fixed_costs). */
export interface EntreeFrais {
  ticketId: number
  coutManuel: number
  /** coutManuel / N liens */
  partManuel: number
  pourcentage: number
  baseReouverture: number
  fraisReouverture: number
  /** fraisReouverture / N liens */
  partFrais: number
  /** false si coutManuel = 0 (annulé) */
  actif: boolean
}

export interface DetailCoutMateriel {
  prix: EntreePrix[]
  frais: EntreeFrais[]
}

export const TYPES_MATERIEL: { itemtype: string; libelle: string }[] = [
  { itemtype: 'Computer', libelle: 'PC' },
  { itemtype: 'Monitor', libelle: 'Moniteur' },
  { itemtype: 'Phone', libelle: 'Téléphone' },
]

/** POST kanban-api en remontant l'échec (sinon un backend down passe inaperçu). */
async function postCout(url: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST' })
  } catch {
    throw new Error('Backend des coûts injoignable (kanban-api :8080)')
  }
  if (!res.ok) throw new Error(`kanban-api ${res.status}`)
}

export async function ajouterCoutFixe(ticketId: number, montant: number): Promise<void> {
  await postCout(`${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/add?montant=${montant}`)
}

export async function annulerDernierCoutFixe(ticketId: number): Promise<void> {
  await postCout(`${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/cancel-last`)
}

export async function appliquerReouverture(ticketId: number, pourcentage: number): Promise<void> {
  await postCout(`${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/reopen?pourcentage=${pourcentage}`)
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
  fraisReouverture: number
}

export async function chargerCoutsParMateriel(): Promise<CoutMateriel[]> {
  const manuels = await fetch(`${BASE}/ticket-fixed-costs`, { headers: { Accept: 'application/json' } })
    .then((reponse) => (reponse.ok ? (reponse.json() as Promise<CoutFixeApi[]>) : []))
    .catch(() => [] as CoutFixeApi[])
  const coutManuelParTicket = new Map<number, number>()
  const coutReouvertureParTicket = new Map<number, number>()
  for (const manuel of manuels) {
    coutManuelParTicket.set(manuel.ticketId, manuel.coutFixe)
    // Frais de réouverture = montant CUMULÉ figé à chaque réouverture (backend).
    // Il n'est jamais supprimé ni recalculé : une annulation ne le touche pas.
    coutReouvertureParTicket.set(manuel.ticketId, manuel.fraisReouverture ?? 0)
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

/**
 * Charge le détail ligne par ligne des coûts pour un type de matériel.
 * Pour chaque ticket lié à ce type :
 *  - toutes ses entrées TicketCost (prix GLPI), non agrégées
 *  - son entrée ticket_fixed_costs (frais manuels + réouverture)
 * La part de l'élément = valeur / N liens total du ticket.
 */
export async function chargerDetailCoutMateriel(itemtype: string): Promise<DetailCoutMateriel> {
  const manuels = await fetch(`${BASE}/ticket-fixed-costs`, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? (r.json() as Promise<CoutFixeApi[]>) : []))
    .catch(() => [] as CoutFixeApi[])
  const fixedParTicket = new Map<number, CoutFixeApi>()
  for (const m of manuels) fixedParTicket.set(m.ticketId, m)

  const tickets = await listerTicketsFront()
  const prixEntrees: EntreePrix[] = []
  const fraisEntrees: EntreeFrais[] = []

  await pool(tickets, 6, async (ticket) => {
    try {
      const liens = await getSousItemsLegacy('Ticket', ticket.id, 'Item_Ticket')
      const liensType = liens.filter((l) => String(l.itemtype ?? '') === itemtype)
      if (liensType.length === 0) return

      const nLiens = liens.length
      const couts = await getSousItemsLegacy('Ticket', ticket.id, 'TicketCost')

      for (const cout of couts) {
        const coutFixe = Number(cout.cost_fixed) || 0
        const coutTemps = ((Number(cout.actiontime) || 0) / 3600) * (Number(cout.cost_time) || 0)
        prixEntrees.push({
          ticketId: ticket.id,
          nom: String(cout.name ?? ''),
          date: String(cout.begin_date ?? ''),
          coutFixe,
          coutTemps,
          part: (coutFixe + coutTemps) / nLiens,
          actif: coutFixe > 0 || coutTemps > 0,
        })
      }

      const fixed = fixedParTicket.get(ticket.id)
      if (fixed) {
        const coutManuel = fixed.coutFixe ?? 0
        const fraisReouverture = fixed.fraisReouverture ?? 0
        if (coutManuel > 0 || fraisReouverture > 0) {
          fraisEntrees.push({
            ticketId: ticket.id,
            coutManuel,
            partManuel: coutManuel / nLiens,
            pourcentage: fixed.pourcentageReouverture ?? 0,
            baseReouverture: fixed.baseReouverture ?? 0,
            fraisReouverture,
            partFrais: fraisReouverture / nLiens,
            actif: coutManuel > 0,
          })
        }
      }
    } catch {
      void 0
    }
  })

  return { prix: prixEntrees, frais: fraisEntrees }
}
