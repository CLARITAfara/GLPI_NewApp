// Validation des fichiers d'import AVANT tout appel API.
// Vérifie : en-têtes attendus, formats (date/heure/nombre/enum/JSON),
// cohérence inter-fichiers, et correspondance images ZIP ↔ assets.

import { analyserCsv } from './csvUtil'
import {
  SCHEMA_INVENTAIRE,
  SCHEMA_TICKETS,
  SCHEMA_COUTS,
  normaliser,
  type ColonneSchema,
  type FichierSchema,
  type ItemType,
} from './importSchemas'

// ─── Types de sortie ─────────────────────────────────────────────────────────

export interface ErreurValidation {
  /** Libellé du fichier concerné. */
  fichier: string
  /** N° de ligne CSV (1-based) ou null pour une erreur d'en-tête/fichier. */
  ligne: number | null
  /** Nom de la colonne concernée (ou '—'). */
  colonne: string
  /** Valeur fautive (tronquée). */
  valeur: string
  message: string
}

export interface AssetImport {
  numLigne: number
  name: string
  itemType: ItemType
  status: string
  location: string
  manufacturer: string
  model: string
  inventoryNumber: string
  user: string
}

export interface TicketImport {
  numLigne: number
  /** Référence libre (clé de liaison interne, ex. « TK-001 »). */
  ref: string
  /** "YYYY-MM-DD HH:MM:SS" */
  date: string
  type: number
  titre: string
  description: string
  status: number
  priority: number
  items: string[]
}

export interface CoutImport {
  numLigne: number
  numTicket: string
  duration: number
  costTime: number
  costFixed: number
}

export interface DonneesImport {
  assets: AssetImport[]
  tickets: TicketImport[]
  couts: CoutImport[]
  /** Noms d'images trouvés dans le ZIP (chemin d'entrée). */
  images: string[]
  /** Images du ZIP ne correspondant à aucun asset (avertissement). */
  imagesSansAsset: string[]
  /** Assets sans image correspondante (avertissement). */
  assetsSansImage: string[]
}

export interface EntreesImport {
  inventaire: string | null
  tickets: string | null
  couts: string | null
  imagesZip: ArrayBuffer | null
}

export interface ResultatValidation {
  ok: boolean
  erreurs: ErreurValidation[]
  donnees: DonneesImport
}

// ─── Validation d'une cellule ────────────────────────────────────────────────

interface ResCellule {
  ok: boolean
  message?: string
  /** Valeur normalisée (date ISO, code enum, etc.). */
  valeur?: string | number | string[]
}

/**
 * Parseur de date « tolérant » : on n'impose plus un seul format. Accepte les
 * séparateurs `/`, `-` ou `.` et les deux ordres courants des exports :
 *   • AAAA-MM-JJ (ISO, ex. 2025-10-05)  → détecté quand le 1er groupe a 4 chiffres
 *   • JJ/MM/AAAA et J/M/AAAA (FR, jour/mois sur 1 ou 2 chiffres, ex. 23/2/2026)
 * Renvoie toujours la date normalisée en `AAAA-MM-JJ` (format attendu par GLPI).
 */
function validerDate(v: string): ResCellule {
  if (v === '') return { ok: false, message: 'date requise' }

  let y: number, mo: number, d: number
  // 1er groupe sur 4 chiffres → ordre ISO AAAA-MM-JJ.
  let m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(v)
  if (m) {
    y = Number(m[1]); mo = Number(m[2]); d = Number(m[3])
  } else {
    // Sinon ordre français JJ/MM/AAAA (jour et mois sur 1 ou 2 chiffres).
    m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(v)
    if (!m) return { ok: false, message: 'format attendu JJ/MM/AAAA ou AAAA-MM-JJ' }
    d = Number(m[1]); mo = Number(m[2]); y = Number(m[3])
  }

  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return { ok: false, message: 'date inexistante' }
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return { ok: true, valeur: `${y}-${p(mo)}-${p(d)}` }
}

/** Distance de Levenshtein (insertions/suppressions/substitutions). */
function distanceLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prec = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cour = [i]
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1
      cour[j] = Math.min(cour[j - 1] + 1, prec[j] + 1, prec[j - 1] + cout)
    }
    prec = cour
  }
  return prec[b.length]
}

/**
 * Rattrapage flou : renvoie le code de la clé la plus proche de `saisie` dans
 * `map`, à condition que la distance reste sous un seuil adapté à la longueur
 * (≤1 pour les libellés courts, ≤2 sinon). Ignore les clés numériques/très
 * courtes pour éviter les faux positifs (« 1 » ≈ « l »). `undefined` si rien
 * d'assez proche.
 */
function correspondanceFloue(
  saisie: string,
  map: Record<string, string | number>,
): string | number | undefined {
  let meilleur: string | number | undefined
  let meilleureDist = Infinity
  for (const cle of Object.keys(map)) {
    if (cle.length < 3) continue
    const seuil = cle.length <= 4 ? 1 : 2
    const d = distanceLevenshtein(saisie, cle)
    if (d <= seuil && d < meilleureDist) {
      meilleureDist = d
      meilleur = map[cle]
    }
  }
  return meilleur
}

function validerCellule(col: ColonneSchema, brut: string): ResCellule {
  const v = brut.trim()

  switch (col.regle) {
    case 'texte':
      return v === '' ? { ok: false, message: 'valeur requise' } : { ok: true, valeur: v }

    case 'texte-optionnel':
      return { ok: true, valeur: v }

    case 'entier':
      if (!/^\d+$/.test(v)) return { ok: false, message: 'entier positif attendu' }
      return { ok: true, valeur: Number(v) }

    case 'nombre-fr': {
      if (v === '') return { ok: false, message: 'nombre attendu' }
      const n = Number(v.replace(/\s/g, '').replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) return { ok: false, message: 'nombre positif attendu' }
      return { ok: true, valeur: n }
    }

    case 'nombre-fr-optionnel': {
      // Cellule vide acceptée et ramenée à 0 (coût non renseigné).
      if (v === '') return { ok: true, valeur: 0 }
      const n = Number(v.replace(/\s/g, '').replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) return { ok: false, message: 'nombre positif attendu' }
      return { ok: true, valeur: n }
    }

    case 'date':
      return validerDate(v)

    case 'heure-hhmm': {
      const m = /^(\d{2}):(\d{2})$/.exec(v)
      if (!m) return { ok: false, message: 'format attendu HH:MM' }
      const h = Number(m[1])
      const mi = Number(m[2])
      if (h > 23 || mi > 59) return { ok: false, message: 'heure invalide' }
      return { ok: true, valeur: `${m[1]}:${m[2]}:00` }
    }

    case 'enum': {
      const map = col.correspondances ?? {}
      const cle = normaliser(v)
      // 1. Correspondance exacte. 2. Sinon, si la colonne l'autorise, rattrapage
      //    flou tolérant aux fautes de frappe (ex. « mdeium » → medium).
      let code = map[cle]
      if (code === undefined && col.flou && cle !== '') {
        code = correspondanceFloue(cle, map)
      }
      if (code === undefined) {
        return {
          ok: false,
          message: `valeur non reconnue (acceptées : ${[...new Set(Object.keys(map))].join(', ')})`,
        }
      }
      return { ok: true, valeur: code }
    }

    case 'json-array': {
      if (v === '') return { ok: true, valeur: [] }
      let parsed: unknown
      try {
        parsed = JSON.parse(v)
      } catch {
        return { ok: false, message: 'tableau JSON invalide (ex. ["PC-ADM-001"])' }
      }
      if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
        return { ok: false, message: 'tableau de chaînes attendu' }
      }
      return { ok: true, valeur: parsed as string[] }
    }
  }
}

// ─── Validation d'un fichier ─────────────────────────────────────────────────

function tronquer(v: string, n = 40): string {
  return v.length > n ? v.slice(0, n) + '…' : v
}

interface FichierAnalyse {
  /** map colonne → valeur normalisée, par ligne (uniquement lignes valides). */
  lignes: { numLigne: number; valeurs: Record<string, string | number | string[]> }[]
}

function validerFichier(
  schema: FichierSchema,
  contenu: string,
  erreurs: ErreurValidation[],
): FichierAnalyse {
  const { entetes, lignes } = analyserCsv(contenu)
  const lignesValides: FichierAnalyse['lignes'] = []

  // 1. En-têtes attendus — correspondance insensible à la casse et aux espaces
  //    de bord. Les exports varient sur la casse (ex. `STATuS`, `ItEM_TYPe`,
  //    `DURATION_second`) : on mappe chaque en-tête normalisé → son index réel
  //    pour les accepter sans imposer une casse exacte.
  const normEntete = (s: string) => s.trim().toLowerCase()
  const enteteParNom: Record<string, number> = {}
  entetes.forEach((e, i) => {
    const cle = normEntete(e)
    if (cle !== '' && !(cle in enteteParNom)) enteteParNom[cle] = i
  })

  const manquantes = schema.colonnes
    .filter((c) => !(normEntete(c.nom) in enteteParNom))
    .map((c) => c.nom)
  const nomsAttendus = new Set(schema.colonnes.map((c) => normEntete(c.nom)))
  const inattendues = entetes.filter((e) => e !== '' && !nomsAttendus.has(normEntete(e)))

  for (const col of manquantes) {
    erreurs.push({
      fichier: schema.libelle,
      ligne: 1,
      colonne: col,
      valeur: '',
      message: 'colonne attendue manquante',
    })
  }
  for (const col of inattendues) {
    erreurs.push({
      fichier: schema.libelle,
      ligne: 1,
      colonne: col,
      valeur: '',
      message: 'colonne inattendue (ignorée)',
    })
  }
  // Si des colonnes manquent, on ne peut pas valider les valeurs de façon fiable.
  if (manquantes.length > 0) return { lignes: lignesValides }

  const indexCol: Record<string, number> = {}
  schema.colonnes.forEach((c) => {
    indexCol[c.nom] = enteteParNom[normEntete(c.nom)] ?? -1
  })

  // 2. Valeurs cellule par cellule
  for (const { numLigne, valeurs } of lignes) {
    const ligneOk: Record<string, string | number | string[]> = {}
    let ligneValide = true

    for (const col of schema.colonnes) {
      const brut = valeurs[indexCol[col.nom]] ?? ''
      const res = validerCellule(col, brut)
      if (!res.ok) {
        ligneValide = false
        erreurs.push({
          fichier: schema.libelle,
          ligne: numLigne,
          colonne: col.nom,
          valeur: tronquer(brut.trim()),
          message: res.message ?? 'valeur invalide',
        })
      } else {
        ligneOk[col.nom] = res.valeur as string | number | string[]
      }
    }

    if (ligneValide) lignesValides.push({ numLigne, valeurs: ligneOk })
  }

  return { lignes: lignesValides }
}

// ─── Lecture des noms d'entrées d'un ZIP (sans dépendance) ───────────────────

interface EntreeZip {
  nom: string
  /** Méthode de compression (0 = stockée, 8 = deflate). */
  methode: number
  /** Taille compressée (octets). */
  tailleComp: number
  /** Offset de l'en-tête local de l'entrée. */
  offsetLocal: number
}

/**
 * Lit le « central directory » d'un ZIP et renvoie ses entrées (sans
 * décompresser). Suffisant pour lister/valider ; l'extraction se fait à part.
 */
function lireEntreesZip(buffer: ArrayBuffer): EntreeZip[] {
  const vue = new DataView(buffer)
  const octets = new Uint8Array(buffer)
  const td = new TextDecoder('utf-8')

  // End Of Central Directory (signature 0x06054b50)
  let eocd = -1
  for (let i = octets.length - 22; i >= 0; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) return []

  const nbEntrees = vue.getUint16(eocd + 10, true)
  let off = vue.getUint32(eocd + 16, true)

  const entrees: EntreeZip[] = []
  for (let n = 0; n < nbEntrees; n++) {
    if (vue.getUint32(off, true) !== 0x02014b50) break // signature entrée centrale
    const methode = vue.getUint16(off + 10, true)
    const tailleComp = vue.getUint32(off + 20, true)
    const lenNom = vue.getUint16(off + 28, true)
    const lenExtra = vue.getUint16(off + 30, true)
    const lenComment = vue.getUint16(off + 32, true)
    const offsetLocal = vue.getUint32(off + 42, true)
    const nom = td.decode(octets.subarray(off + 46, off + 46 + lenNom))
    entrees.push({ nom, methode, tailleComp, offsetLocal })
    off += 46 + lenNom + lenExtra + lenComment
  }
  return entrees
}

/** Liste des noms de fichiers d'un ZIP (hors dossiers et __MACOSX). */
export function lireNomsZip(buffer: ArrayBuffer): string[] {
  return lireEntreesZip(buffer)
    .map((e) => e.nom)
    .filter((n) => !n.startsWith('__MACOSX') && !n.endsWith('/'))
}

/** Décompresse un flux deflate brut (méthode 8) via DecompressionStream. */
async function inflateRaw(donnees: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const flux = new Blob([new Uint8Array(donnees)]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

const MIMES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
}

/**
 * Détecte le format réel d'une image d'après ses octets d'en-tête (magic bytes).
 * Indispensable car GLPI REFUSE un fichier dont le contenu ne correspond pas à
 * son extension (ex. un JPEG nommé `.png` → upload rejeté, "Fichier introuvable").
 * Renvoie null pour les formats sans signature binaire fiable (SVG).
 */
function detecterTypeImage(b: Uint8Array): { ext: string; mime: string } | null {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { ext: 'png', mime: 'image/png' }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return { ext: 'gif', mime: 'image/gif' }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return { ext: 'webp', mime: 'image/webp' }
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d)
    return { ext: 'bmp', mime: 'image/bmp' }
  return null
}

export interface ImageZip {
  /** Chemin complet dans le ZIP. */
  chemin: string
  /** Nom de base sans dossier ni extension (clé de correspondance asset). */
  base: string
  /** Nom de fichier (avec extension). */
  filename: string
  blob: Blob
}

/**
 * Extrait (et décompresse) les fichiers image d'un ZIP. Renvoie une entrée par
 * fichier exploitable, indexée par `base` (nom sans extension).
 */
export async function extraireImagesZip(buffer: ArrayBuffer): Promise<ImageZip[]> {
  const octets = new Uint8Array(buffer)
  const vue = new DataView(buffer)
  const images: ImageZip[] = []

  for (const e of lireEntreesZip(buffer)) {
    if (e.nom.startsWith('__MACOSX') || e.nom.endsWith('/')) continue

    // En-tête local : recalcul des longueurs nom/extra (peuvent différer du central)
    if (vue.getUint32(e.offsetLocal, true) !== 0x04034b50) continue
    const lenNom = vue.getUint16(e.offsetLocal + 26, true)
    const lenExtra = vue.getUint16(e.offsetLocal + 28, true)
    const debut = e.offsetLocal + 30 + lenNom + lenExtra
    const compresse = octets.subarray(debut, debut + e.tailleComp)

    let contenu: Uint8Array
    if (e.methode === 0) {
      contenu = compresse
    } else if (e.methode === 8) {
      contenu = await inflateRaw(compresse)
    } else {
      continue // méthode non gérée
    }

    const nomZip = e.nom.split('/').pop() ?? e.nom
    const base = nomZip.replace(/\.[^.]+$/, '')
    const extDeclaree = (nomZip.split('.').pop() ?? '').toLowerCase()

    // L'extension réelle prime sur celle du nom : un JPEG nommé `.png` doit
    // être ré-étiqueté `.jpg` (avec le bon MIME) sinon GLPI rejette l'upload.
    // `base` (sans extension) reste inchangé : c'est la clé d'association à
    // l'asset, indépendante de l'extension.
    const detecte = detecterTypeImage(contenu)
    const ext = detecte?.ext ?? extDeclaree
    const mime = detecte?.mime ?? MIMES[extDeclaree] ?? 'application/octet-stream'
    const filename = ext ? `${base}.${ext}` : base

    images.push({
      chemin: e.nom,
      base,
      filename,
      blob: new Blob([new Uint8Array(contenu)], { type: mime }),
    })
  }
  return images
}

/** Nom de base sans dossier ni extension. */
function baseSansExt(chemin: string): string {
  const base = chemin.split('/').pop() ?? chemin
  return base.replace(/\.[^.]+$/, '')
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

/**
 * @param entrees       Contenu des feuilles CSV (et ZIP) à valider.
 * @param assetsBddNoms Noms (en minuscules) des matériels déjà présents dans
 *   GLPI. Un `Items` de la Feuille 2 est valide s'il figure dans la Feuille 1
 *   OU dans cet ensemble. `null` = GLPI injoignable : la vérification se limite
 *   alors à la Feuille 1 (tout matériel absent de la Feuille 1 est bloqué).
 */
export function validerImport(
  entrees: EntreesImport,
  assetsBddNoms?: Set<string> | null,
): ResultatValidation {
  const erreurs: ErreurValidation[] = []

  const donnees: DonneesImport = {
    assets: [],
    tickets: [],
    couts: [],
    images: [],
    imagesSansAsset: [],
    assetsSansImage: [],
  }

  // Chaque feuille peut être importée seule : au moins un CSV suffit.
  // Les dépendances entre feuilles (Items→Inventaire, Num_Ticket→Tickets) sont
  // vérifiées plus bas — un import partiel est BLOQUÉ s'il contient des lignes
  // qui référencent une feuille non fournie.
  if (!entrees.inventaire && !entrees.tickets && !entrees.couts) {
    erreurs.push({
      fichier: '—',
      ligne: null,
      colonne: '—',
      valeur: '',
      message: 'aucun fichier CSV fourni — sélectionnez au moins une feuille',
    })
  }

  const invAnalyse = entrees.inventaire
    ? validerFichier(SCHEMA_INVENTAIRE, entrees.inventaire, erreurs)
    : { lignes: [] }
  const tickAnalyse = entrees.tickets
    ? validerFichier(SCHEMA_TICKETS, entrees.tickets, erreurs)
    : { lignes: [] }
  const coutAnalyse = entrees.couts
    ? validerFichier(SCHEMA_COUTS, entrees.couts, erreurs)
    : { lignes: [] }

  // ── Construction des assets + détection de doublons de Name ──
  const nomsAssets = new Set<string>()
  for (const { numLigne, valeurs } of invAnalyse.lignes) {
    const name = String(valeurs.Name)
    if (nomsAssets.has(name)) {
      erreurs.push({
        fichier: SCHEMA_INVENTAIRE.libelle,
        ligne: numLigne,
        colonne: 'Name',
        valeur: name,
        message: 'nom en double',
      })
      continue
    }
    nomsAssets.add(name)
    donnees.assets.push({
      numLigne,
      name,
      itemType: valeurs.Item_Type as ItemType,
      status: String(valeurs.Status),
      location: String(valeurs.Location),
      manufacturer: String(valeurs.Manufacturer),
      model: String(valeurs.Model),
      inventoryNumber: String(valeurs.Inventory_Number ?? ''),
      user: String(valeurs.User ?? ''),
    })
  }

  // ── Construction des tickets + doublons de Ref + cohérence Items ──
  const refsTickets = new Set<string>()
  for (const { numLigne, valeurs } of tickAnalyse.lignes) {
    const ref = String(valeurs.Ref_Ticket)
    if (refsTickets.has(ref)) {
      erreurs.push({
        fichier: SCHEMA_TICKETS.libelle,
        ligne: numLigne,
        colonne: 'Ref_Ticket',
        valeur: ref,
        message: 'référence en double',
      })
      continue
    }

    const items = valeurs.Items as string[]
    // Un matériel lié est valide s'il est dans la Feuille 1 OU déjà présent en
    // base GLPI. Sinon le ticket est bloqué.
    const inconnus = items.filter(
      (it) => !nomsAssets.has(it) && !(assetsBddNoms?.has(it.toLowerCase()) ?? false),
    )
    if (inconnus.length > 0) {
      const ou = entrees.inventaire ? 'la Feuille 1' : 'la Feuille 1 (non fournie)'
      const bdd = assetsBddNoms === null ? ' (vérification GLPI impossible)' : ' ni dans GLPI'
      erreurs.push({
        fichier: SCHEMA_TICKETS.libelle,
        ligne: numLigne,
        colonne: 'Items',
        valeur: tronquer(inconnus.join(', ')),
        message: `matériel(s) introuvable(s) dans ${ou}${bdd} : ${inconnus.join(', ')}`,
      })
      continue
    }

    refsTickets.add(ref)
    donnees.tickets.push({
      numLigne,
      ref,
      date: `${String(valeurs.Date)} ${String(valeurs.Heure)}`,
      type: Number(valeurs.Type),
      titre: String(valeurs.Titre),
      description: String(valeurs.Description),
      status: Number(valeurs.Status),
      priority: Number(valeurs.Priority),
      items,
    })
  }

  // ── Construction des coûts + cohérence Num_Ticket ──
  for (const { numLigne, valeurs } of coutAnalyse.lignes) {
    const numTicket = String(valeurs.Num_Ticket)
    if (!refsTickets.has(numTicket)) {
      erreurs.push({
        fichier: SCHEMA_COUTS.libelle,
        ligne: numLigne,
        colonne: 'Num_Ticket',
        valeur: numTicket,
        message: entrees.tickets
          ? 'ticket introuvable dans la Feuille 2'
          : 'Feuille 2 (Tickets) non fournie — requise pour rattacher ce coût',
      })
      continue
    }
    donnees.couts.push({
      numLigne,
      numTicket,
      // Durée arrondie : GLPI attend un entier de secondes.
      duration: Math.round(Number(valeurs.Duration_second)),
      costTime: Number(valeurs.Time_Cost),
      costFixed: Number(valeurs.Fixed_Cost),
    })
  }

  // ── Validation du ZIP d'images (avertissements seulement) ──
  if (entrees.imagesZip) {
    const entrees_zip = lireNomsZip(entrees.imagesZip).filter(
      (n) => !n.startsWith('__MACOSX') && !n.endsWith('/'),
    )
    donnees.images = entrees_zip
    const basesImages = new Set(entrees_zip.map(baseSansExt))
    donnees.imagesSansAsset = [...basesImages].filter((b) => !nomsAssets.has(b))
    donnees.assetsSansImage = [...nomsAssets].filter((n) => !basesImages.has(n))
  }

  return { ok: erreurs.length === 0, erreurs, donnees }
}
