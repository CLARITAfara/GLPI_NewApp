// Utilitaires CSV purs (aucun IO) — toutes les fonctions sont synchrones

export interface LigneCsv {
  [colonne: string]: string
}

/**
 * Parse un contenu CSV brut en tableau de lignes.
 * La première ligne est traitée comme en-tête.
 */
export function parserCsv(contenu: string, separateur = ','): LigneCsv[] {
  const lignes = contenu.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lignes.length < 2) return []

  const entetes = lignes[0].split(separateur).map((h) => h.trim())
  return lignes.slice(1).map((ligne) => {
    const valeurs = ligne.split(separateur)
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
