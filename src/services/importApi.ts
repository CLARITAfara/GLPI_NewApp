// Exécution de l'import vers GLPI avec création automatique des listes
// déroulantes / utilisateurs manquants et rollback atomique en cas d'échec.
//
// Assets / users / dropdowns / tickets / coûts : API OAuth High-Level.
// Images (documents liés) ET liens matériel↔ticket (colonne Items → relation
// Item_Ticket) : API REST legacy (`/api/v1`, cf. legacyApi.ts). L'API OAuth
// High-Level n'expose pas de route de création pour ces deux types, mais la
// legacy le permet — elle nécessite VITE_GLPI_USER_TOKEN.

import { apiFetch } from './apiClient'
import { fetchList } from './glpiApi'
import { extraireImagesZip, type DonneesImport } from './importValidation'
import { ITEM_TYPES, type ItemType } from './importSchemas'
import {
  fermerSession,
  lierItemTicket,
  ouvrirSession,
  supprimerDocument,
  supprimerItemTicket,
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
    liens: number
  }
  /**
   * Matériels déjà présents dans GLPI (même nom + même type) qui ont été
   * RÉUTILISÉS au lieu d'être recréés — évite les doublons à chaque ré-import.
   */
  materielReutilise: number
  /** Liens matériel↔ticket non importés (jeton legacy absent ou échec). */
  liensIgnores: number
  /**
   * Détail des liens matériel↔ticket en échec (non bloquant). Une entrée par
   * lien : "PC ↔ ticket #N — message".
   */
  liensEchecs: string[]
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

// Les endpoints par itemtype (asset + modèle) vivent dans ITEM_TYPES
// (importSchemas.ts) ; ici seulement les listes partagées et les tickets.
const EP = {
  state: '/Dropdowns/State',
  location: '/Dropdowns/Location',
  manufacturer: '/Dropdowns/Manufacturer',
  user: '/Administration/User',
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

// ─── Détection des doublons (matériels déjà présents dans GLPI) ──────────────

/**
 * Charge tous les couples nom→id d'un endpoint (paginé). La clé est le nom en
 * minuscules pour une comparaison insensible à la casse. La corbeille est
 * exclue (on ne déduplique que sur les éléments actifs).
 */
async function chargerNomsExistants(endpoint: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const pageSize = 500
  let start = 0
  while (true) {
    const { items, total } = await fetchList(endpoint, { start, limit: pageSize })
    for (const it of items) {
      const nom = String((it as Record<string, unknown>).name ?? '').toLowerCase()
      if (nom && typeof it.id === 'number' && !map.has(nom)) map.set(nom, it.id)
    }
    start += items.length
    if (start >= total || items.length === 0) break
  }
  return map
}

export interface AssetExistant {
  name: string
  itemType: ItemType
  id: number
}

/**
 * Pré-charge les noms existants (nom→id) pour chaque itemtype présent dans les
 * assets à importer. Une seule requête paginée par type concerné.
 */
async function chargerNomsParType(
  donnees: DonneesImport,
): Promise<Map<ItemType, Map<string, number>>> {
  const typesPresents = [...new Set(donnees.assets.map((a) => a.itemType))]
  const resultat = new Map<ItemType, Map<string, number>>()
  await Promise.all(
    typesPresents.map(async (t) => {
      resultat.set(t, await chargerNomsExistants(ITEM_TYPES[t].assetEndpoint))
    }),
  )
  return resultat
}

/**
 * Détecte, parmi les assets à importer, ceux qui existent DÉJÀ dans GLPI
 * (même nom + même type). Sert à prévenir l'utilisateur à la validation et à
 * éviter les doublons.
 */
export async function detecterAssetsExistants(
  donnees: DonneesImport,
): Promise<AssetExistant[]> {
  const nomsParType = await chargerNomsParType(donnees)

  const existants: AssetExistant[] = []
  for (const a of donnees.assets) {
    const id = nomsParType.get(a.itemType)?.get(a.name.toLowerCase())
    if (id !== undefined) existants.push({ name: a.name, itemType: a.itemType, id })
  }
  return existants
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

  const totalLiens = donnees.tickets.reduce((s, t) => s + t.items.length, 0)
  const rapport: RapportImport = {
    ok: false,
    cree: { materiel: 0, tickets: 0, couts: 0, listes: 0, utilisateurs: 0, documents: 0, liens: 0 },
    materielReutilise: 0,
    liensIgnores: totalLiens,
    liensEchecs: [],
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
  const assetParNom = new Map<string, { id: number; itemType: ItemType }>()

  try {
    // ── Étape 1 : matériel (résout listes + utilisateur, puis crée l'asset) ──
    // Anti-doublons : on pré-charge les noms existants par type ; un asset déjà
    // présent (même nom) est réutilisé tel quel au lieu d'être recréé.
    const existantParType = await chargerNomsParType(donnees)
    const videMap = new Map<string, number>()

    const etape1 = 'Matériel (assets)'
    onProgress({ etape: etape1, courant: 0, total: donnees.assets.length })
    for (let i = 0; i < donnees.assets.length; i++) {
      const a = donnees.assets[i]
      const config = ITEM_TYPES[a.itemType]

      // Doublon : asset déjà présent dans GLPI → réutilisé, pas recréé.
      const mapExist = existantParType.get(a.itemType) ?? videMap
      const dejaId = mapExist.get(a.name.toLowerCase())
      if (dejaId !== undefined) {
        assetParNom.set(a.name, { id: dejaId, itemType: a.itemType })
        rapport.materielReutilise++
        onProgress({ etape: etape1, courant: i + 1, total: donnees.assets.length })
        continue
      }

      const statusId = await trouverOuCreer(EP.state, 'name', a.status, { name: a.status }, { sansCorbeille: true, compteur: 'listes' })
      const locationId = await trouverOuCreer(EP.location, 'name', a.location, { name: a.location }, { sansCorbeille: true, compteur: 'listes' })
      const manuId = await trouverOuCreer(EP.manufacturer, 'name', a.manufacturer, { name: a.manufacturer }, { sansCorbeille: true, compteur: 'listes' })
      const modelId = await trouverOuCreer(config.modelEndpoint, 'name', a.model, { name: a.model }, { sansCorbeille: true, compteur: 'listes' })

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

      const id = await creer(config.assetEndpoint, corps)
      planifierSuppressionHL(`${config.assetEndpoint}/${id}`)
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

    // ── Étape 5 : liens matériel ↔ ticket (relation Item_Ticket, API legacy) ──
    // Comme les images : best-effort et non bloquant. La colonne Items de la
    // feuille tickets relie chaque ticket aux assets déjà créés à l'étape 1.
    const liens: Array<{ itemType: string; itemId: number; ticketId: number; libelle: string }> = []
    for (const t of donnees.tickets) {
      const ticketId = ticketIdParRef.get(t.ref)
      if (ticketId === undefined) continue
      for (const nom of t.items) {
        const asset = assetParNom.get(nom)
        if (!asset) continue // asset absent (improbable : validé en amont)
        liens.push({
          itemType: asset.itemType,
          itemId: asset.id,
          ticketId,
          libelle: `${nom} ↔ ticket #${t.ref}`,
        })
      }
    }

    if (liens.length > 0) {
      const etape5 = 'Liens matériel ↔ ticket'
      onProgress({ etape: etape5, courant: 0, total: liens.length })

      let sessionOk = uploadDisponible()
      if (!sessionOk) {
        rapport.liensEchecs.push(
          `${liens.length} lien(s) non importé(s) — jeton legacy (VITE_GLPI_USER_TOKEN) absent`,
        )
      } else {
        try {
          await ouvrirSession() // idempotent : déjà ouverte si des images ont été envoyées
        } catch (err) {
          sessionOk = false
          rapport.liensEchecs.push(
            `Liens non importés — session legacy indisponible : ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      for (let i = 0; sessionOk && i < liens.length; i++) {
        const l = liens[i]
        try {
          const id = await lierItemTicket({
            itemtype: l.itemType,
            items_id: l.itemId,
            tickets_id: l.ticketId,
          })
          annulations.push(() => supprimerItemTicket(id))
          rapport.cree.liens++
        } catch (err) {
          rapport.liensEchecs.push(
            `${l.libelle} — ${err instanceof Error ? err.message : String(err)}`,
          )
        }
        onProgress({ etape: etape5, courant: i + 1, total: liens.length })
      }
    }
    rapport.liensIgnores = totalLiens - rapport.cree.liens

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
