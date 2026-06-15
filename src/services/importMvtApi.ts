// Import CSV des mouvements de tickets — réutilise la logique métier du Kanban.
// CSV à 3 colonnes : ticket, mvt, valeur.
//  - reopened : réouverture (valeur = pourcentage du dernier coût)
//  - cancel   : annulation d'une clôture erronée (valeur ignorée)
//  - close    : clôture (valeur = solution)
import { analyserCsv } from './csvUtil'
import { changerStatutTicket, resoudreTicket } from './ticketsFrontApi'
import { ajouterCoutFixe, annulerDernierCoutFixe, appliquerReouverture } from './coutsApi'

export type MvtType = 'reopened' | 'cancel' | 'close'

export interface LigneImport {
  numLigne: number
  ticket: number
  mvt: MvtType
  valeur: string
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
    const ticket = Number((valeurs[0] ?? '').trim())
    const mvt = normaliserMvt(valeurs[1] ?? '')
    const valeur = (valeurs[2] ?? '').trim()
    if (!ticket || !mvt) {
      erreurs.push({ numLigne, ticket, mvt: valeurs[1] ?? '', ok: false, message: 'Ticket ou mouvement invalide' })
      continue
    }
    ok.push({ numLigne, ticket, mvt, valeur })
  }
  return { lignes: ok, erreurs }
}

/** Applique une ligne. Si mvt = cancel, la valeur n'est PAS prise en compte. */
export async function appliquerLigne(l: LigneImport): Promise<ResultatLigne> {
  try {
    if (l.mvt === 'reopened') {
      await changerStatutTicket(l.ticket, 2)
      await appliquerReouverture(l.ticket, Number(l.valeur) || 0)
    } else if (l.mvt === 'cancel') {
      await changerStatutTicket(l.ticket, 2)
      await annulerDernierCoutFixe(l.ticket) // valeur ignorée
    } else {
      // close / terminer : valeur = montant du coût fixe (« Super Coût »).
      // GLPI exige une solution → texte générique ; le montant alimente /couts.
      await resoudreTicket(l.ticket, 'Clôturé via import CSV')
      const cout = Number(l.valeur) || 0
      if (cout > 0) await ajouterCoutFixe(l.ticket, cout)
    }
    return { numLigne: l.numLigne, ticket: l.ticket, mvt: l.mvt, ok: true, message: 'OK' }
  } catch (e) {
    return {
      numLigne: l.numLigne, ticket: l.ticket, mvt: l.mvt,
      ok: false, message: e instanceof Error ? e.message : 'Erreur',
    }
  }
}
