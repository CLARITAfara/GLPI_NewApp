// Import CSV des mouvements de tickets — réutilise la logique métier du Kanban.
// CSV à 3 colonnes : ticket, mvt, valeur.
//  - colonne ticket = Ref_Ticket (référence libre du CSV d'import des tickets),
//    résolue vers l'id GLPI par ORDRE DE CRÉATION : Ref N = Nème ticket trié par
//    id croissant (le Ref_Ticket n'est pas persisté côté GLPI).
//  - reopened : réouverture (valeur = pourcentage du dernier coût)
//  - cancel   : annulation d'une clôture erronée (valeur ignorée)
//  - close    : clôture (valeur = montant du coût fixe « Super Coût »)
import { analyserCsv } from './csvUtil'
import { changerStatutTicket, resoudreTicket, listerTicketsFront } from './ticketsFrontApi'
import { ajouterCoutFixe, annulerDernierCoutFixe, appliquerReouverture } from './coutsApi'

export type MvtType = 'reopened' | 'cancel' | 'close'

export interface LigneImport {
  numLigne: number
  /** Ref_Ticket (1-based) tel que saisi dans le CSV — résolu plus tard en id GLPI. */
  ref: number
  mvt: MvtType
  valeur: string
}

/** Résout un Ref_Ticket (1-based) vers un id GLPI, ou undefined si hors borne. */
export type ResolveurRef = (ref: number) => number | undefined

/**
 * Construit le résolveur Ref → id GLPI : Ref N = Nème ticket trié par id
 * croissant. Hypothèse (cf. choix « par ordre de création ») : les tickets
 * proviennent d'un import sur une base propre.
 */
export async function chargerResolveurRef(): Promise<ResolveurRef> {
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
  if (['reopened', 'reouverture', 'réouverture'].includes(v)) return 'reopened'
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
    if (!ref || !mvt) {
      erreurs.push({ numLigne, ticket: ref, mvt: valeurs[1] ?? '', ok: false, message: 'Ref ou mouvement invalide' })
      continue
    }
    ok.push({ numLigne, ref, mvt, valeur })
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
      await appliquerReouverture(ticketId, Number(l.valeur) || 0)
    } else if (l.mvt === 'cancel') {
      await changerStatutTicket(ticketId, 2)
      await annulerDernierCoutFixe(ticketId) // valeur ignorée
    } else {
      // close / terminer : valeur = montant du coût fixe (« Super Coût »).
      // GLPI exige une solution → texte générique ; le montant alimente /couts.
      await resoudreTicket(ticketId, 'Clôturé via import CSV')
      const cout = Number(l.valeur) || 0
      if (cout > 0) await ajouterCoutFixe(ticketId, cout)
    }
    return { numLigne: l.numLigne, ticket: l.ref, mvt: l.mvt, ok: true, message: `OK (ticket #${ticketId})` }
  } catch (e) {
    return {
      numLigne: l.numLigne, ticket: l.ref, mvt: l.mvt,
      ok: false, message: e instanceof Error ? e.message : 'Erreur',
    }
  }
}
