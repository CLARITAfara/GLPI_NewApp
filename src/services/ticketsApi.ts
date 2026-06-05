// Service tickets — API GLPI High-Level (OAuth). Liste + fiche détaillée + coûts.
// (À ne pas confondre avec l'ancien ticketApi.ts, qui ciblait l'API Express locale.)

import { apiFetch } from './apiClient'
import { fetchList } from './glpiApi'
import type { GlpiRow } from './glpiApi'

const ENDPOINT = '/Assistance/Ticket'

/** Type de ticket GLPI : 1 = Incident, 2 = Demande. */
export const LIBELLES_TYPE: Record<number, string> = {
  1: 'Incident',
  2: 'Demande',
}

/** Statut GLPI (1..6). */
export const LIBELLES_STATUT: Record<number, string> = {
  1: 'Nouveau',
  2: 'En cours (attribué)',
  3: 'En cours (planifié)',
  4: 'En attente',
  5: 'Résolu',
  6: 'Clos',
}

/** Classe CSS du badge de statut (couleur). */
export const CLASSE_STATUT: Record<number, string> = {
  1: 'st-new',
  2: 'st-progress',
  3: 'st-progress',
  4: 'st-pending',
  5: 'st-solved',
  6: 'st-closed',
}

/** Priorité GLPI (1..6). */
export const LIBELLES_PRIORITE: Record<number, string> = {
  1: 'Très basse',
  2: 'Basse',
  3: 'Moyenne',
  4: 'Haute',
  5: 'Très haute',
  6: 'Majeure',
}

/** Objet lié renvoyé par l'API ({id, name}). */
export interface RefObjet {
  id?: number
  name?: string
}

export interface Ticket {
  id: number
  name: string
  content?: string
  type?: number
  priority?: number
  urgency?: number
  impact?: number
  status?: RefObjet | number
  category?: RefObjet | null
  entity?: RefObjet | null
  date?: string
  date_creation?: string
  date_mod?: string
  date_solve?: string
  date_close?: string
  actiontime?: number
}

export interface CoutTicket {
  id: number
  name?: string
  duration?: number
  cost_time?: number
  cost_fixed?: number
  cost_material?: number
}

/** Lit l'id d'un champ lié, qu'il arrive en objet {id} ou en nombre brut. */
export function lireId(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as RefObjet).id
    return typeof id === 'number' ? id : undefined
  }
  return undefined
}

// ── Libellés ─────────────────────────────────────────────────────────────────

export function libelleType(t?: number): string {
  return t ? (LIBELLES_TYPE[t] ?? `Type ${t}`) : '—'
}

export function libelleStatut(status: Ticket['status']): string {
  const id = lireId(status)
  if (id && LIBELLES_STATUT[id]) return LIBELLES_STATUT[id]
  if (status && typeof status === 'object' && status.name) return status.name
  return '—'
}

export function libellePriorite(p?: number): string {
  return p ? (LIBELLES_PRIORITE[p] ?? String(p)) : '—'
}

// ── Appels API ───────────────────────────────────────────────────────────────

/** Liste paginée des tickets (l'API scope déjà selon le profil/session). */
export async function listerTickets(limit = 200): Promise<{ items: Ticket[]; total: number }> {
  const { items, total } = await fetchList(ENDPOINT, { limit })
  return { items: items as unknown as Ticket[], total }
}

/** Fiche complète d'un ticket. */
export async function getTicket(id: number): Promise<Ticket> {
  const res = await apiFetch(`${ENDPOINT}/${id}`)
  if (!res.ok) throw new Error(`Erreur ${res.status} lors du chargement du ticket.`)
  return (await res.json()) as Ticket
}

/** Coûts liés à un ticket (best-effort : tableau vide si indisponible). */
export async function getCouts(id: number): Promise<CoutTicket[]> {
  try {
    const res = await apiFetch(`${ENDPOINT}/${id}/Cost`)
    if (!res.ok) return []
    const data = (await res.json()) as GlpiRow[]
    return Array.isArray(data) ? (data as unknown as CoutTicket[]) : []
  } catch {
    return []
  }
}
