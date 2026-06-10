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
import { pool } from './concurrency'
import {
  creerItemLegacy,
  fermerSession,
  lierItemTicket,
  ouvrirSession,
  supprimerDocument,
  supprimerItemLegacy,
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
  /**
   * Liens volontairement ignorés (information, pas une erreur) : types non
   * associables aux tickets dans GLPI (Cable, Socket…). Une entrée par lien.
   */
  liensIgnoresInfo: string[]
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

/** Code GLPI du statut « Nouveau » — seul statut autorisé à la création d'un ticket. */
const STATUT_NEW = 1

/** Nombre de requêtes HL menées en parallèle dans chaque phase de l'import. */
const CONCURRENCE = 8

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

/** Met à jour un élément via PATCH (champs partiels). */
async function mettreAJour(path: string, corps: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!res.ok) {
    const detail = await texteErreur(res)
    throw new Error(`PATCH ${path} → ${res.status}${detail ? ` (${detail})` : ''}`)
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
async function chargerNomsExistants(
  endpoint: string,
  sansCorbeille = false,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const pageSize = 500
  let start = 0
  while (true) {
    // Les types sans corbeille (pas de champ is_deleted, ex. Socket) ne
    // supportent pas le filtre is_deleted==false → on l'omet.
    const { items, total } = await fetchList(endpoint, { start, limit: pageSize, includeDeleted: sansCorbeille })
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
 * Matériels présents dans GLPI, indexés par itemtype puis par nom (minuscule).
 * Sert à la fois à éviter les doublons, à valider les liens Tickets→matériel
 * (un asset référencé peut exister en base sans figurer dans la Feuille 1) et à
 * rattacher ces liens à l'import.
 */
export type AssetsBdd = Map<ItemType, Map<string, number>>

/** Charge tous les matériels des types gérés (cf. ITEM_TYPES) présents dans GLPI. */
export async function chargerAssetsExistants(): Promise<AssetsBdd> {
  const bdd: AssetsBdd = new Map()
  const types = Object.keys(ITEM_TYPES) as ItemType[]
  await Promise.all(
    types.map(async (t) => {
      const c = ITEM_TYPES[t]
      try {
        bdd.set(t, await chargerNomsExistants(c.assetEndpoint, c.sansCorbeille))
      } catch {
        // Type indisponible (désactivé/non autorisé sur cette instance) : on
        // l'ignore pour la détection plutôt que de faire échouer tout le reste.
        bdd.set(t, new Map())
      }
    }),
  )
  return bdd
}

/** Ensemble des noms (en minuscules) de tous les matériels présents dans GLPI. */
export function nomsAssetsBdd(bdd: AssetsBdd): Set<string> {
  const noms = new Set<string>()
  for (const map of bdd.values()) {
    for (const nom of map.keys()) noms.add(nom)
  }
  return noms
}

/**
 * Parmi les assets à importer, ceux qui existent DÉJÀ dans GLPI (même nom +
 * même type) — calculé à partir d'un chargement déjà effectué, sans nouvelle
 * requête.
 */
export function assetsExistantsDansBdd(
  donnees: DonneesImport,
  bdd: AssetsBdd,
): AssetExistant[] {
  const existants: AssetExistant[] = []
  for (const a of donnees.assets) {
    const id = bdd.get(a.itemType)?.get(a.name.toLowerCase())
    if (id !== undefined) existants.push({ name: a.name, itemType: a.itemType, id })
  }
  return existants
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function importer(
  donnees: DonneesImport,
  onProgress: (p: ProgressionImport) => void,
  zip?: ArrayBuffer | null,
  bdd?: AssetsBdd | null,
): Promise<RapportImport> {
  // Pile de rollback : actions de suppression exécutées en ordre inverse.
  const annulations: Array<() => Promise<void>> = []
  // Cache find-or-create : clé "endpoint::champ::valeur" → PROMESSE de l'id.
  // On mémorise la promesse (pas l'id résolu) pour que des tâches parallèles
  // demandant la même valeur partagent un unique appel réseau et évitent de
  // créer des doublons de listes déroulantes.
  const cache = new Map<string, Promise<number>>()

  const totalLiens = donnees.tickets.reduce((s, t) => s + t.items.length, 0)
  const rapport: RapportImport = {
    ok: false,
    cree: { materiel: 0, tickets: 0, couts: 0, listes: 0, utilisateurs: 0, documents: 0, liens: 0 },
    materielReutilise: 0,
    liensIgnores: totalLiens,
    liensEchecs: [],
    liensIgnoresInfo: [],
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

    // La promesse est posée dans le cache AVANT le premier await : un second
    // appel concurrent pour la même valeur récupère cette promesse au lieu de
    // relancer une recherche/création (qui créerait un doublon).
    const promesse = (async (): Promise<number> => {
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
        return trouve.id
      }

      const id = await creer(endpoint, corps)
      planifierSuppressionHL(`${endpoint}/${id}`)
      rapport.cree[opts.compteur]++
      return id
    })()

    cache.set(cle, promesse)
    return promesse
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
    // Matériels déjà présents dans GLPI : fournis par l'appelant (chargés une
    // seule fois pour la validation) ou chargés ici à défaut. Servent au
    // dédoublonnage (étape 1) ET au rattachement des liens vers des assets qui
    // existent en base sans figurer dans la Feuille 1 (étape 5).
    const bddAssets = bdd ?? (await chargerAssetsExistants())
    const videMap = new Map<string, number>()

    // Certains types (CartridgeItem, ConsumableItem) n'ont pas de route de
    // création High-Level : ils passent par l'API legacy, qui exige une session
    // (donc le jeton VITE_GLPI_USER_TOKEN). On l'ouvre une fois en amont.
    const besoinLegacy = donnees.assets.some((a) => ITEM_TYPES[a.itemType].viaLegacy)
    if (besoinLegacy) {
      if (!uploadDisponible()) {
        throw new Error(
          'Cartouches/Consommables présents mais jeton legacy (VITE_GLPI_USER_TOKEN) absent — impossible de les créer.',
        )
      }
      await ouvrirSession()
    }

    const etape1 = 'Matériel (assets)'
    let faits1 = 0
    onProgress({ etape: etape1, courant: 0, total: donnees.assets.length })
    // Traitement parallèle borné : les listes déroulantes partagées (statut,
    // localisation, fabricant, modèle, utilisateur) sont dédupliquées via le
    // cache de promesses de `trouverOuCreer`, donc aucun doublon malgré la
    // concurrence. Chaque asset enregistre son rollback dès sa création.
    await pool(donnees.assets, CONCURRENCE, async (a, i) => {
      const config = ITEM_TYPES[a.itemType]

      // Doublon : asset déjà présent dans GLPI → réutilisé, pas recréé.
      const mapExist = bddAssets.get(a.itemType) ?? videMap
      const dejaId = mapExist.get(a.name.toLowerCase())
      if (dejaId !== undefined) {
        assetParNom.set(a.name, { id: dejaId, itemType: a.itemType })
        rapport.materielReutilise++
        onProgress({ etape: etape1, courant: ++faits1, total: donnees.assets.length })
        return
      }

      // ── Types sans route HL (Cartouches/Consommables) : création legacy. ──
      if (config.viaLegacy) {
        const champsL = new Set(config.champs)
        const [locId, manuId] = await Promise.all([
          champsL.has('location') && a.location
            ? trouverOuCreer(EP.location, 'name', a.location, { name: a.location }, { sansCorbeille: true, compteur: 'listes' })
            : Promise.resolve(undefined),
          champsL.has('manufacturer') && a.manufacturer
            ? trouverOuCreer(EP.manufacturer, 'name', a.manufacturer, { name: a.manufacturer }, { sansCorbeille: true, compteur: 'listes' })
            : Promise.resolve(undefined),
        ])
        // Corps legacy : champs `*_id` (ids GLPI résolus via l'API HL ci-dessus).
        const input: Record<string, unknown> = { name: a.name }
        if (locId !== undefined) input.locations_id = locId
        if (manuId !== undefined) input.manufacturers_id = manuId

        const id = await creerItemLegacy(config.itemType, input)
        annulations.push(() => supprimerItemLegacy(config.itemType, id))
        assetParNom.set(a.name, { id, itemType: a.itemType })
        rapport.cree.materiel++
        onProgress({ etape: etape1, courant: ++faits1, total: donnees.assets.length })
        return
      }

      // Chaque champ n'est résolu que si le TYPE le supporte (cf. config.champs
      // / statusField / modelEndpoint) ET si une valeur non vide est fournie.
      // Les listes partagées sont dédupliquées par le cache de promesses.
      const champs = new Set(config.champs)
      const login = a.user ? slugLogin(a.user) || `user${i}` : ''
      const [statusId, locationId, manuId, modelId, userId] = await Promise.all([
        config.statusField && a.status
          ? trouverOuCreer(EP.state, 'name', a.status, { name: a.status }, { sansCorbeille: true, compteur: 'listes' })
          : Promise.resolve(undefined),
        champs.has('location') && a.location
          ? trouverOuCreer(EP.location, 'name', a.location, { name: a.location }, { sansCorbeille: true, compteur: 'listes' })
          : Promise.resolve(undefined),
        champs.has('manufacturer') && a.manufacturer
          ? trouverOuCreer(EP.manufacturer, 'name', a.manufacturer, { name: a.manufacturer }, { sansCorbeille: true, compteur: 'listes' })
          : Promise.resolve(undefined),
        config.modelEndpoint && a.model
          ? trouverOuCreer(config.modelEndpoint, 'name', a.model, { name: a.model }, { sansCorbeille: true, compteur: 'listes' })
          : Promise.resolve(undefined),
        champs.has('user') && login
          ? trouverOuCreer(EP.user, 'username', login, { username: login, realname: a.user }, { compteur: 'utilisateurs', restaurer: true })
          : Promise.resolve(undefined),
      ])

      const corps: Record<string, unknown> = { name: a.name }
      if (config.statusField && statusId !== undefined) corps[config.statusField] = { id: statusId }
      if (locationId !== undefined) corps.location = { id: locationId }
      if (manuId !== undefined) corps.manufacturer = { id: manuId }
      if (modelId !== undefined) corps.model = { id: modelId }
      if (userId !== undefined) corps.user = { id: userId }
      if (champs.has('otherserial') && a.inventoryNumber) corps.otherserial = a.inventoryNumber

      const id = await creer(config.assetEndpoint, corps)
      planifierSuppressionHL(`${config.assetEndpoint}/${id}`)
      assetParNom.set(a.name, { id, itemType: a.itemType })
      rapport.cree.materiel++
      onProgress({ etape: etape1, courant: ++faits1, total: donnees.assets.length })
    })

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
              itemtype: ITEM_TYPES[asset.itemType].ticketItemtype ?? asset.itemType,
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
    // GLPI impose le workflow depuis « Nouveau » : créer un ticket directement
    // dans un statut avancé (résolu, clos…) est refusé, et un ticket clos REFUSE
    // ensuite l'ajout de coûts ou de matériel lié. On crée donc en statut New (1)
    // et on applique le statut final tout à la fin (étape 6), une fois coûts et
    // liens rattachés.
    const etape3 = 'Tickets'
    const ticketIdParRef = new Map<string, number>()
    let faits3 = 0
    onProgress({ etape: etape3, courant: 0, total: donnees.tickets.length })
    await pool(donnees.tickets, CONCURRENCE, async (t) => {
      const id = await creer(EP.ticket, {
        name: t.titre,
        content: t.description,
        type: t.type,
        priority: t.priority,
        status: { id: STATUT_NEW },
        date: t.date,
      })
      planifierSuppressionHL(`${EP.ticket}/${id}`)
      ticketIdParRef.set(t.ref, id)
      rapport.cree.tickets++
      onProgress({ etape: etape3, courant: ++faits3, total: donnees.tickets.length })
    })

    // ── Étape 4 : coûts ──
    const etape4 = 'Coûts des tickets'
    let faits4 = 0
    onProgress({ etape: etape4, courant: 0, total: donnees.couts.length })
    await pool(donnees.couts, CONCURRENCE, async (c) => {
      const ticketId = ticketIdParRef.get(c.numTicket)
      if (ticketId === undefined) return // validé en amont
      const id = await creer(`${EP.ticket}/${ticketId}/Cost`, {
        name: 'Coût (import CSV)',
        duration: c.duration,
        cost_time: c.costTime,
        cost_fixed: c.costFixed,
      })
      planifierSuppressionHL(`${EP.ticket}/${ticketId}/Cost/${id}`)
      rapport.cree.couts++
      onProgress({ etape: etape4, courant: ++faits4, total: donnees.couts.length })
    })

    // ── Étape 5 : liens matériel ↔ ticket (relation Item_Ticket, API legacy) ──
    // Comme les images : best-effort et non bloquant. La colonne Items de la
    // feuille tickets relie chaque ticket aux assets déjà créés à l'étape 1.
    const liens: Array<{ itemType: string; itemId: number; ticketId: number; libelle: string }> = []
    // Un même matériel peut figurer plusieurs fois dans la colonne Items d'un
    // ticket (ex. ["EQP-023","EQP-044","EQP-023"]). GLPI impose l'unicité du
    // triplet (itemtype, items_id, tickets_id) : on déduplique donc les liens
    // pour ne pas déclencher une « Duplicate entry … unicity » au 2e POST.
    const liensVus = new Set<string>()
    for (const t of donnees.tickets) {
      const ticketId = ticketIdParRef.get(t.ref)
      if (ticketId === undefined) continue
      for (const nom of t.items) {
        // Asset créé/réutilisé dans cet import, sinon matériel déjà en base
        // (cas d'un import de la Feuille 2 seule, sans la Feuille 1).
        let asset = assetParNom.get(nom)
        if (!asset) {
          const cle = nom.toLowerCase()
          for (const [t, map] of bddAssets) {
            const id = map.get(cle)
            if (id !== undefined) {
              asset = { id, itemType: t }
              break
            }
          }
        }
        if (!asset) continue // asset introuvable (validé en amont)
        // Certains types (Cable, Socket…) ne sont pas associables à un ticket
        // dans GLPI : tenter le lien renvoie une 500. On l'ignore proprement.
        if (ITEM_TYPES[asset.itemType].associableTicket === false) {
          rapport.liensIgnoresInfo.push(
            `${nom} ↔ ticket #${t.ref} — type ${asset.itemType} non associable aux tickets`,
          )
          continue
        }
        // itemtype = classe GLPI (namespacée pour Socket), pas la clé interne.
        const itemType = ITEM_TYPES[asset.itemType].ticketItemtype ?? asset.itemType
        // Doublon (même matériel déjà lié à ce ticket) → on l'ignore silencieusement.
        const cleLien = `${itemType}#${asset.id}#${ticketId}`
        if (liensVus.has(cleLien)) continue
        liensVus.add(cleLien)
        liens.push({
          itemType,
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

      let faits5 = 0
      if (sessionOk) {
        await pool(liens, CONCURRENCE, async (l) => {
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
          onProgress({ etape: etape5, courant: ++faits5, total: liens.length })
        })
      }
    }
    rapport.liensIgnores = totalLiens - rapport.cree.liens

    // ── Étape 6 : statut final des tickets ──
    // Appliqué EN DERNIER : un ticket clos/résolu refuse l'ajout de coûts et de
    // matériel lié, faits aux étapes 4 et 5 pendant que le ticket est « Nouveau ».
    const aBasculer = donnees.tickets.filter((t) => t.status !== STATUT_NEW)
    if (aBasculer.length > 0) {
      const etape6 = 'Statut des tickets'
      let faits6 = 0
      onProgress({ etape: etape6, courant: 0, total: aBasculer.length })
      await pool(aBasculer, CONCURRENCE, async (t) => {
        const ticketId = ticketIdParRef.get(t.ref)
        if (ticketId !== undefined) {
          await mettreAJour(`${EP.ticket}/${ticketId}`, { status: { id: t.status } })
        }
        onProgress({ etape: etape6, courant: ++faits6, total: aBasculer.length })
      })
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
