// Import CSV des mouvements de tickets — réutilise la logique métier du Kanban.
// CSV à 4 colonnes : ticket, mvt, valeur, mode.
//  - colonne ticket = Ref_Ticket (la même référence que la Feuille 2 d'import),
//    résolue vers l'id GLPI via la correspondance persistée à l'import dans
//    newapp.db (table ticket_refs). À défaut (table vide / ancien import), repli
//    sur l'ordre de création : Ref N = Nème ticket trié par id croissant.
//  - reopened : réouverture (valeur = pourcentage à appliquer ; colonne mode =
//    1 dernier coût / 2 premier coût / 3 moyenne / 4 somme des coûts)
//  - cancel   : annulation d'une clôture erronée (valeur ignorée)
//  - close    : clôture (valeur = montant du coût fixe « Super Coût »)
import { analyserCsv } from './csvUtil'
import { changerStatutTicket, resoudreTicket, listerTicketsFront } from './ticketsFrontApi'
import { ajouterCoutFixe, annulerDernierCoutFixe, appliquerReouverture } from './coutsApi'
import { chargerRefs } from './ticketRefApi'

export type MvtType = 'reopened' | 'cancel' | 'close'

export interface LigneImport {
  numLigne: number
  /** Ref_Ticket (1-based) tel que saisi dans le CSV — résolu plus tard en id GLPI. */
  ref: number
  mvt: MvtType
  valeur: string
  /** Mode de calcul de la base de réouverture (1 à 4). Lu uniquement si mvt = reopened. */
  modeCalcul: number
}

/** Résout un Ref_Ticket (1-based) vers un id GLPI, ou undefined si hors borne. */
export type ResolveurRef = (ref: number) => number | undefined

/**
 * Construit le résolveur Ref → id GLPI. Source principale : la correspondance
 * Ref_Ticket → id GLPI persistée à l'import (newapp.db). Repli, si la table est
 * vide (ancien import) : Ref N = Nème ticket trié par id croissant.
 */
export async function chargerResolveurRef(): Promise<ResolveurRef> {
  // Source fiable : la table Ref → id GLPI persistée à l'import (newapp.db).
  const refs = await chargerRefs()
  if (refs.size > 0) return (ref) => refs.get(ref)
  // Repli (table vide / anciens imports) : Ref N = Nème ticket par id croissant.
  const tickets = await listerTicketsFront(1000)
  const tries = [...tickets].sort((a, b) => a.id - b.id)
  return (ref) => tries[ref - 1]?.id
}

export interface ResultatLigne {
  numLigne: number
  ticket: number
  mvt: string
  ok: boolean
  message: string
}

/** Normalise le libellé du mouvement (FR/EN, casse libre) vers un type canonique. */
function normaliserMvt(brut: string): MvtType | null {
  const v = brut.trim().toLowerCase()
  if (['reopened', 'reopen', 'open', 'reouverture', 'réouverture'].includes(v)) return 'reopened'
  if (['cancel', 'annuler', 'annulation'].includes(v)) return 'cancel'
  if (['close', 'closed', 'terminer', 'cloturer', 'clôturer'].includes(v)) return 'close'
  return null
}

/** Analyse le CSV (3 colonnes) : lignes valides d'un côté, erreurs de format de l'autre. */
export function parserImportMvt(contenu: string): { lignes: LigneImport[]; erreurs: ResultatLigne[] } {
  const { lignes } = analyserCsv(contenu)
  const ok: LigneImport[] = []
  const erreurs: ResultatLigne[] = []
  for (const { numLigne, valeurs } of lignes) {
    const ref = Number((valeurs[0] ?? '').trim())
    const mvt = normaliserMvt(valeurs[1] ?? '')
    const valeur = (valeurs[2] ?? '').trim()
    // 4e colonne « mode » : prise en compte uniquement pour une réouverture.
    const modeBrut = Number((valeurs[3] ?? '').trim())
    const modeCalcul = mvt === 'reopened' && [1, 2, 3, 4].includes(modeBrut) ? modeBrut : 1
    if (!ref || !mvt) {
      erreurs.push({ numLigne, ticket: ref, mvt: valeurs[1] ?? '', ok: false, message: 'Ref ou mouvement invalide' })
      continue
    }
    ok.push({ numLigne, ref, mvt, valeur, modeCalcul })
  }
  return { lignes: ok, erreurs }
}

/**
 * Applique une ligne. La colonne ticket est un Ref_Ticket résolu vers l'id GLPI
 * via `resoudreRef`. Si mvt = cancel, la valeur n'est PAS prise en compte.
 */
export async function appliquerLigne(l: LigneImport, resoudreRef: ResolveurRef): Promise<ResultatLigne> {
  const ticketId = resoudreRef(l.ref)
  if (ticketId === undefined) {
    return { numLigne: l.numLigne, ticket: l.ref, mvt: l.mvt, ok: false, message: `Ref ${l.ref} introuvable` }
  }
  try {
    if (l.mvt === 'reopened') {
      await changerStatutTicket(ticketId, 2)
      await appliquerReouverture(ticketId, Number(l.valeur) || 0, l.modeCalcul)
    } else if (l.mvt === 'cancel') {
      await changerStatutTicket(ticketId, 2)
      await annulerDernierCoutFixe(ticketId) // valeur ignorée
    } else {
      // close / terminer : valeur = montant du coût fixe (« Super Coût »).
      // GLPI exige une solution → texte générique ; le montant alimente /couts.
      await resoudreTicket(ticketId, 'Clôturé via import CSV')
      const cout = Number(l.valeur) || 0
      await ajouterCoutFixe(ticketId, cout) // toujours : une clôture à 0 € compte aussi dans nombre_couts (moyenne mode 3)
    }
    return { numLigne: l.numLigne, ticket: l.ref, mvt: l.mvt, ok: true, message: `OK (ticket #${ticketId})` }
  } catch (e) {
    return {
      numLigne: l.numLigne, ticket: l.ref, mvt: l.mvt,
      ok: false, message: e instanceof Error ? e.message : 'Erreur',
    }
  }
}
