// Exécution de l'import vers GLPI avec création automatique des listes
// déroulantes / utilisateurs manquants et rollback atomique en cas d'échec.
//
// Assets / users / dropdowns / tickets / coûts : API OAuth High-Level.
// Images → documents liés aux assets : API REST legacy (`/api/v1`), seule à
// gérer l'upload de fichiers (cf. legacyApi.ts). Le lien asset↔ticket (colonne
// Items) reste non importable : aucune API GLPI ne l'expose.

import { apiFetch } from './apiClient'
import { fetchList } from './glpiApi'
import { extraireImagesZip, type DonneesImport } from './importValidation'
import {
  fermerSession,
  ouvrirSession,
  supprimerDocument,
  uploaderDocument,
  uploadDisponible,
} from './legacyApi'

export interface ProgressionImport {
  etape: string
  courant: number
  total: number
}

export interface RapportImport {
  ok: boolean
  cree: {
    materiel: number
    tickets: number
    couts: number
    listes: number
    utilisateurs: number
    documents: number
  }
  /** Liens asset↔ticket non importés (aucune API GLPI ne l'expose). */
  liensIgnores: number
  /** Images non importées (sans asset, jeton legacy absent, ou upload refusé). */
  imagesIgnorees: number
  /**
   * Détail des images dont l'upload a échoué (non bloquant). Une entrée par
   * image : "nom — message". Permet d'expliquer un "Fichier X introuvable"
   * renvoyé par GLPI quand il refuse le fichier (type/contenu).
   */
  imagesEchecs: string[]
  rollback: boolean
  erreur?: string
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

const EP = {
  state: '/Dropdowns/State',
  location: '/Dropdowns/Location',
  manufacturer: '/Dropdowns/Manufacturer',
  computerModel: '/Dropdowns/ComputerModel',
  monitorModel: '/Dropdowns/MonitorModel',
  user: '/Administration/User',
  computer: '/Assets/Computer',
  monitor: '/Assets/Monitor',
  ticket: '/Assistance/Ticket',
}

// ─── Helpers HTTP ────────────────────────────────────────────────────────────

async function texteErreur(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (Array.isArray(body) && body.length > 0) {
      return String((body[0] as Record<string, unknown>)?.message ?? '')
    }
    if (body && typeof body === 'object' && 'message' in body) {
      return String((body as Record<string, unknown>).message)
    }
  } catch {
    /* corps non-JSON */
  }
  return ''
}

/** Restaure un élément de la corbeille (is_deleted = false) via PATCH. */
async function restaurer(endpoint: string, id: number): Promise<void> {
  const res = await apiFetch(`${endpoint}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_deleted: false }),
  })
  if (!res.ok) {
    const detail = await texteErreur(res)
    throw new Error(`PATCH ${endpoint}/${id} → ${res.status}${detail ? ` (${detail})` : ''}`)
  }
}

async function creer(endpoint: string, corps: Record<string, unknown>): Promise<number> {
  const res = await apiFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!res.ok) {
    const detail = await texteErreur(res)
    throw new Error(`POST ${endpoint} → ${res.status}${detail ? ` (${detail})` : ''}`)
  }
  const data: unknown = await res.json()
  const id = Array.isArray(data)
    ? (data[0] as Record<string, unknown>)?.id
    : (data as Record<string, unknown>)?.id
  if (typeof id !== 'number') throw new Error(`POST ${endpoint} : identifiant absent de la réponse`)
  return id
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function importer(
  donnees: DonneesImport,
  onProgress: (p: ProgressionImport) => void,
  zip?: ArrayBuffer | null,
): Promise<RapportImport> {
  // Pile de rollback : actions de suppression exécutées en ordre inverse.
  const annulations: Array<() => Promise<void>> = []
  // Cache find-or-create : clé "endpoint::champ::valeur" → id.
  const cache = new Map<string, number>()

  const rapport: RapportImport = {
    ok: false,
    cree: { materiel: 0, tickets: 0, couts: 0, listes: 0, utilisateurs: 0, documents: 0 },
    liensIgnores: donnees.tickets.reduce((s, t) => s + t.items.length, 0),
    imagesIgnorees: donnees.images.length,
    imagesEchecs: [],
    rollback: false,
  }

  /** Programme une suppression HL (DELETE avec purge) pour le rollback. */
  function planifierSuppressionHL(path: string): void {
    const chemin = path.includes('?') ? path : `${path}?force=true`
    annulations.push(async () => {
      try {
        await apiFetch(chemin, { method: 'DELETE' })
      } catch {
        /* best-effort */
      }
    })
  }

  /** Cherche un item par un champ ; le crée s'il est absent. */
  async function trouverOuCreer(
    endpoint: string,
    champ: string,
    valeur: string,
    corps: Record<string, unknown>,
    opts: { sansCorbeille?: boolean; compteur: 'listes' | 'utilisateurs'; restaurer?: boolean },
  ): Promise<number> {
    const cle = `${endpoint}::${champ}::${valeur}`
    const enCache = cache.get(cle)
    if (enCache !== undefined) return enCache

    // Les ressources à corbeille (utilisateurs) doivent être cherchées AUSSI
    // dans la corbeille : un enregistrement supprimé occupe toujours son nom
    // unique en base, donc le recréer échoue en 500 ("existe déjà"). On le
    // retrouve et on le restaure plutôt que de le recréer.
    const inclureCorbeille = opts.sansCorbeille || opts.restaurer
    const { items } = await fetchList(endpoint, {
      filter: `${champ}==${valeur}`,
      limit: 50,
      includeDeleted: inclureCorbeille,
    })
    const trouve = items.find((it) => String((it as Record<string, unknown>)[champ]) === valeur)
    if (trouve && typeof trouve.id === 'number') {
      if (opts.restaurer && (trouve as Record<string, unknown>).is_deleted === true) {
        await restaurer(endpoint, trouve.id)
      }
      cache.set(cle, trouve.id)
      return trouve.id
    }

    const id = await creer(endpoint, corps)
    planifierSuppressionHL(`${endpoint}/${id}`)
    rapport.cree[opts.compteur]++
    cache.set(cle, id)
    return id
  }

  const slugLogin = (nom: string): string =>
    nom
      .normalize('NFD')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '')

  // Assets créés : name → { id, itemType } (pour rattacher les images).
  const assetParNom = new Map<string, { id: number; itemType: 'Computer' | 'Monitor' }>()

  try {
    // ── Étape 1 : matériel (résout listes + utilisateur, puis crée l'asset) ──
    const etape1 = 'Matériel (ordinateurs / moniteurs)'
    onProgress({ etape: etape1, courant: 0, total: donnees.assets.length })
    for (let i = 0; i < donnees.assets.length; i++) {
      const a = donnees.assets[i]

      const statusId = await trouverOuCreer(EP.state, 'name', a.status, { name: a.status }, { sansCorbeille: true, compteur: 'listes' })
      const locationId = await trouverOuCreer(EP.location, 'name', a.location, { name: a.location }, { sansCorbeille: true, compteur: 'listes' })
      const manuId = await trouverOuCreer(EP.manufacturer, 'name', a.manufacturer, { name: a.manufacturer }, { sansCorbeille: true, compteur: 'listes' })
      const modelEp = a.itemType === 'Computer' ? EP.computerModel : EP.monitorModel
      const modelId = await trouverOuCreer(modelEp, 'name', a.model, { name: a.model }, { sansCorbeille: true, compteur: 'listes' })

      const corps: Record<string, unknown> = {
        name: a.name,
        status: { id: statusId },
        location: { id: locationId },
        manufacturer: { id: manuId },
        model: { id: modelId },
      }
      if (a.inventoryNumber) corps.otherserial = a.inventoryNumber
      if (a.user) {
        const login = slugLogin(a.user) || `user${i}`
        const userId = await trouverOuCreer(
          EP.user,
          'username',
          login,
          { username: login, realname: a.user },
          { compteur: 'utilisateurs', restaurer: true },
        )
        corps.user = { id: userId }
      }

      const endpoint = a.itemType === 'Computer' ? EP.computer : EP.monitor
      const id = await creer(endpoint, corps)
      planifierSuppressionHL(`${endpoint}/${id}`)
      assetParNom.set(a.name, { id, itemType: a.itemType })
      rapport.cree.materiel++
      onProgress({ etape: etape1, courant: i + 1, total: donnees.assets.length })
    }

    // ── Étape 2 : images → documents liés (API legacy) ──
    if (zip && donnees.images.length > 0 && uploadDisponible()) {
      const images = await extraireImagesZip(zip)
      const aUploader = images.filter((img) => assetParNom.has(img.base))
      if (aUploader.length > 0) {
        const etape2 = 'Images (documents liés)'
        onProgress({ etape: etape2, courant: 0, total: aUploader.length })

        // Les images sont accessoires : un échec ici ne doit JAMAIS interrompre
        // l'import du matériel/tickets/coûts ni déclencher le rollback global.
        // On consigne chaque échec et on poursuit. NB : quand GLPI refuse un
        // fichier (type non autorisé, contenu illisible), l'API legacy renvoie
        // un trompeur "Fichier X introuvable" (cf. APIRest::manageUploadedFiles
        // qui enregistre _filename même quand l'upload est rejeté).
        let sessionOk = true
        try {
          await ouvrirSession()
        } catch (err) {
          sessionOk = false
          rapport.imagesEchecs.push(
            `Images non importées — session legacy indisponible : ${err instanceof Error ? err.message : String(err)}`,
          )
        }

        for (let i = 0; sessionOk && i < aUploader.length; i++) {
          const img = aUploader[i]
          const asset = assetParNom.get(img.base)!
          try {
            const docId = await uploaderDocument({
              blob: img.blob,
              filename: img.filename,
              name: img.filename,
              itemtype: asset.itemType,
              items_id: asset.id,
            })
            annulations.push(() => supprimerDocument(docId))
            rapport.cree.documents++
          } catch (err) {
            rapport.imagesEchecs.push(
              `${img.filename} — ${err instanceof Error ? err.message : String(err)}`,
            )
          }
          onProgress({ etape: etape2, courant: i + 1, total: aUploader.length })
        }
      }
    }
    rapport.imagesIgnorees = donnees.images.length - rapport.cree.documents

    // ── Étape 3 : tickets ──
    const etape3 = 'Tickets'
    const ticketIdParRef = new Map<number, number>()
    onProgress({ etape: etape3, courant: 0, total: donnees.tickets.length })
    for (let i = 0; i < donnees.tickets.length; i++) {
      const t = donnees.tickets[i]
      const id = await creer(EP.ticket, {
        name: t.titre,
        content: t.description,
        type: t.type,
        priority: t.priority,
        status: { id: t.status },
        date: t.date,
      })
      planifierSuppressionHL(`${EP.ticket}/${id}`)
      ticketIdParRef.set(t.ref, id)
      rapport.cree.tickets++
      onProgress({ etape: etape3, courant: i + 1, total: donnees.tickets.length })
    }

    // ── Étape 4 : coûts ──
    const etape4 = 'Coûts des tickets'
    onProgress({ etape: etape4, courant: 0, total: donnees.couts.length })
    for (let i = 0; i < donnees.couts.length; i++) {
      const c = donnees.couts[i]
      const ticketId = ticketIdParRef.get(c.numTicket)
      if (ticketId === undefined) continue // validé en amont
      const id = await creer(`${EP.ticket}/${ticketId}/Cost`, {
        name: 'Coût (import CSV)',
        duration: c.duration,
        cost_time: c.costTime,
        cost_fixed: c.costFixed,
      })
      planifierSuppressionHL(`${EP.ticket}/${ticketId}/Cost/${id}`)
      rapport.cree.couts++
      onProgress({ etape: etape4, courant: i + 1, total: donnees.couts.length })
    }

    rapport.ok = true
    return rapport
  } catch (err) {
    // ── Rollback atomique : suppression en ordre inverse ──
    rapport.rollback = true
    rapport.erreur = err instanceof Error ? err.message : String(err)
    for (let i = annulations.length - 1; i >= 0; i--) {
      await annulations[i]()
    }
    return rapport
  } finally {
    await fermerSession()
  }
}
