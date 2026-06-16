// Service tickets — Front-office (session OAuth propre, via frontApiFetch).
// Sert la vue Kanban : lister, créer rapidement, déplacer (changer le statut).
// Réutilise les libellés/helpers purs de ticketsApi.ts (LIBELLES_STATUT, lireId…).

import { fetchList } from './glpiApi'
import { frontApiFetch } from './frontSession'
import { lireId } from './ticketsApi'
import type { Ticket } from './ticketsApi'
import { ouvrirSession, creerItemLegacy, uploadDisponible, getSousItemsLegacy } from './legacyApi'

const ENDPOINT = '/Assistance/Ticket'

/**
 * Décrit une information à saisir avant d'appliquer un changement de statut
 * (ex. la solution exigée par GLPI pour résoudre un ticket).
 */
export interface InfoRequise {
  /** Titre de la boîte de dialogue. */
  titre: string
  /** Libellé du champ. */
  label: string
  placeholder: string
  /** Phrase d'explication affichée sous le titre (optionnel). */
  hint?: string
  coutFixe?: boolean
}

/**
 * Colonnes du Kanban. On n'utilise que 3 statuts en écriture
 * (`statutCible` : 1 Nouveau, 2 En cours, 6 Clos) ; `statuts` reste large en
 * lecture pour ranger correctement les tickets déjà dans d'autres statuts.
 * `infoRequise` (optionnel) impose une saisie avant d'appliquer le changement.
 */
export type KanbanColumnId = 'new' | 'progress' | 'done'

export interface KanbanColumnDef {
  id: KanbanColumnId
  titre: string
  /** Statuts GLPI regroupés dans cette colonne (lecture). */
  statuts: number[]
  /** Statut appliqué lors d'un dépôt (drag & drop) ou d'une création. */
  statutCible: number
  /** Si défini, une boîte de dialogue collecte cette info avant le changement. */
  infoRequise?: InfoRequise
}

// 1 Nouveau · 2 En cours (attribué) · 3 En cours (planifié) · 4 En attente
// 5 Résolu · 6 Clos · 10 Validation
export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'new', titre: 'Nouveau', statuts: [1], statutCible: 1 },
  { id: 'progress', titre: 'In progress', statuts: [2, 3, 4, 10], statutCible: 2 },
  {
    id: 'done',
    titre: 'Terminé',
    statuts: [5, 6],
    statutCible: 6,
    infoRequise: {
      titre: 'Clore le ticket',
      label: 'Solution',
      placeholder: 'Décrivez la solution apportée…',
      hint: 'Le ticket passera au statut « Clos ». La solution sera enregistrée dans la fiche.',
      coutFixe: true,
    },
  },
]

/** Trouve la colonne d'un ticket à partir de son statut (défaut : « new »). */
export function colonnePourStatut(status: Ticket['status']): KanbanColumnId {
  const id = lireId(status)
  const col = KANBAN_COLUMNS.find((c) => id !== undefined && c.statuts.includes(id))
  return col?.id ?? 'new'
}

async function parseError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (Array.isArray(body) && body.length > 0)
      return String((body[0] as Record<string, unknown>)?.message ?? '')
    if (body && typeof body === 'object' && 'message' in body)
      return String((body as Record<string, unknown>).message)
  } catch { /* corps non-JSON */ }
  return ''
}

/** Liste des tickets visibles par la session front (déjà scopée par GLPI). */
export async function listerTicketsFront(limit = 200): Promise<Ticket[]> {
  const { items } = await fetchList(ENDPOINT, { limit }, frontApiFetch)
  return items as unknown as Ticket[]
}

/** Fiche complète d'un ticket (front-office). */
export async function getTicketFront(id: number): Promise<Ticket> {
  const res = await frontApiFetch(`${ENDPOINT}/${id}`)
  if (!res.ok) throw new Error(`Erreur ${res.status} lors du chargement du ticket.`)
  return (await res.json()) as Ticket
}

/** Solution d'un ticket (la plus récente), ou null si aucune / indisponible. */
export interface SolutionTicket {
  content: string
  date: string
  /** Statut de la solution GLPI : 2 = acceptée, 3 = refusée, sinon en attente. */
  statut?: number
}

export async function getSolutionTicket(id: number): Promise<SolutionTicket | null> {
  const rows = await getSousItemsLegacy('Ticket', id, 'ITILSolution')
  if (rows.length === 0) return null
  const derniere = rows[rows.length - 1]
  const content = String(derniere.content ?? '').trim()
  if (!content) return null
  return {
    content,
    date: String(derniere.date_creation ?? derniere.date_mod ?? ''),
    statut: Number(derniere.status) || undefined,
  }
}

/** Création rapide d'un ticket (titre seul) avec un statut donné. */
export async function creerTicketRapide(name: string, status: number): Promise<Ticket> {
  const res = await frontApiFetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      content: name, // GLPI exige une description : on reprend le titre
      type: 1, // Incident
      urgency: 3,
      impact: 3,
      priority: 3,
      status,
    }),
  })
  if (!res.ok) {
    const detail = await parseError(res)
    throw new Error(`Erreur ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
  const body = (await res.json()) as { id?: number } | number
  const id = typeof body === 'number' ? body : body.id
  if (!id) throw new Error('Identifiant du ticket non reçu.')
  return { id, name, status, priority: 3 }
}

/**
 * Change le statut d'un ticket (déplacement entre colonnes).
 * Renvoie le statut RÉELLEMENT appliqué par GLPI (lu dans la réponse), afin que
 * le board reflète l'état serveur et non une valeur « devinée ».
 */
export async function changerStatutTicket(id: number, status: number): Promise<number> {
  const res = await frontApiFetch(`${ENDPOINT}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const detail = await parseError(res)
    throw new Error(`Erreur ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
  // GLPI renvoie le ticket complet : on lit le statut effectif.
  try {
    const body = (await res.json()) as { status?: unknown }
    return lireId(body.status) ?? status
  } catch {
    return status
  }
}

/**
 * Clôt un ticket : crée un ITILSolution (qui bascule GLPI en Résolu/5), puis
 * force immédiatement le statut à Clos (6) via un PATCH.
 * Repli : si aucun jeton legacy n'est configuré, on tente un PATCH High-Level direct.
 */
export async function resoudreTicket(id: number, solution: string): Promise<number> {
  if (uploadDisponible()) {
    await ouvrirSession()
    await creerItemLegacy('ITILSolution', {
      itemtype: 'Ticket',
      items_id: id,
      content: solution,
    })
    // Force le statut à Clos (6) — la solution seule ne pose qu'un Résolu (5).
    try {
      await frontApiFetch(`${ENDPOINT}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 6 }),
      })
    } catch { /* best-effort */ }
    // Relit le statut effectivement appliqué par GLPI.
    try {
      const t = await getTicketFront(id)
      return lireId(t.status) ?? 6
    } catch {
      return 6
    }
  }

  const res = await frontApiFetch(`${ENDPOINT}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 6, solution }),
  })
  if (!res.ok) {
    const detail = await parseError(res)
    throw new Error(`Erreur ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
  return 6
}
