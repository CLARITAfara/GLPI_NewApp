// Utilitaires CSV purs (aucun IO) — toutes les fonctions sont synchrones

export interface LigneCsv {
  [colonne: string]: string
}

/** Une ligne de données analysée, avec son numéro de ligne CSV d'origine. */
export interface LigneAnalysee {
  /** N° de ligne dans le fichier (1-based). L'en-tête est la ligne 1. */
  numLigne: number
  /** Valeurs brutes, dans l'ordre des colonnes. */
  valeurs: string[]
}

export interface ResultatCsv {
  /** En-têtes (1ère ligne), nettoyés. */
  entetes: string[]
  /** Lignes de données (hors en-tête). */
  lignes: LigneAnalysee[]
}

/**
 * Analyse un contenu CSV en gérant correctement les guillemets :
 * - virgules et sauts de ligne à l'intérieur d'un champ entre `"…"` ;
 * - guillemets échappés par doublement (`""`).
 *
 * Conserve le numéro de ligne d'origine de chaque enregistrement pour le
 * rapport d'erreurs (le numéro pointe sur la 1ère ligne de l'enregistrement).
 */
export function analyserCsv(contenu: string, separateur = ','): ResultatCsv {
  const enregistrements: LigneAnalysee[] = []
  let champs: string[] = []
  let champ = ''
  let entreGuillemets = false
  let ligne = 1
  let debutEnreg = 1
  let nouvelEnreg = true

  const marquerDebut = () => {
    if (nouvelEnreg) {
      debutEnreg = ligne
      nouvelEnreg = false
    }
  }

  const finDeLigne = () => {
    champs.push(champ)
    // Ignore les lignes entièrement vides
    const vide = champs.length === 1 && champs[0].trim() === ''
    if (!vide) enregistrements.push({ numLigne: debutEnreg, valeurs: champs })
    champs = []
    champ = ''
    nouvelEnreg = true
  }

  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i]

    if (entreGuillemets) {
      if (c === '"') {
        if (contenu[i + 1] === '"') {
          champ += '"'
          i++
        } else {
          entreGuillemets = false
        }
      } else {
        if (c === '\n') ligne++
        champ += c
      }
      continue
    }

    if (c === '"') {
      marquerDebut()
      entreGuillemets = true
    } else if (c === separateur) {
      marquerDebut()
      champs.push(champ)
      champ = ''
    } else if (c === '\r') {
      // ignoré (géré au \n)
    } else if (c === '\n') {
      finDeLigne()
      ligne++
    } else {
      marquerDebut()
      champ += c
    }
  }

  // Dernier enregistrement sans saut de ligne final
  if (champ !== '' || champs.length > 0) finDeLigne()

  if (enregistrements.length === 0) return { entetes: [], lignes: [] }

  const entetes = enregistrements[0].valeurs.map((h) => h.trim())
  return { entetes, lignes: enregistrements.slice(1) }
}

/**
 * Parse un contenu CSV brut en tableau de lignes-objets.
 * La première ligne est traitée comme en-tête. (Compat ascendante)
 */
export function parserCsv(contenu: string, separateur = ','): LigneCsv[] {
  const { entetes, lignes } = analyserCsv(contenu, separateur)
  return lignes.map(({ valeurs }) => {
    const obj: LigneCsv = {}
    for (let i = 0; i < entetes.length; i++) {
      obj[entetes[i]] = (valeurs[i] ?? '').trim()
    }
    return obj
  })
}

/** Convertit un tableau de lignes en chaîne CSV (avec en-tête). */
export function versChaineCsv(lignes: LigneCsv[], separateur = ','): string {
  if (lignes.length === 0) return ''
  const entetes = Object.keys(lignes[0])
  const header = entetes.join(separateur)
  const rows = lignes.map((l) => entetes.map((k) => l[k] ?? '').join(separateur))
  return [header, ...rows].join('\n')
}
