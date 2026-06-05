// Schémas déclaratifs des 3 fichiers CSV d'import + tables de correspondance
// de valeurs vers les codes attendus par l'API GLPI. Tout le « métier » de
// l'import (colonnes attendues, règles par colonne, mappings) est centralisé ici.

export type FichierId = 'inventaire' | 'tickets' | 'couts'

/** Type de règle appliquée à une cellule lors de la validation. */
export type RegleType =
  | 'texte' // requis, non vide
  | 'texte-optionnel' // peut être vide
  | 'entier' // entier >= 0
  | 'nombre-fr' // nombre décimal (virgule FR acceptée), >= 0
  | 'date-ddmmyyyy' // JJ/MM/AAAA
  | 'heure-hhmm' // HH:MM
  | 'enum' // valeur dans `correspondances` (insensible à la casse)
  | 'json-array' // tableau JSON de chaînes

export interface ColonneSchema {
  nom: string
  regle: RegleType
  /** Pour `enum` : libellé (minuscule) → code GLPI. */
  correspondances?: Record<string, string | number>
}

export interface FichierSchema {
  id: FichierId
  /** Libellé affiché dans le rapport d'erreurs. */
  libelle: string
  colonnes: ColonneSchema[]
}

// ─── Tables de correspondance ────────────────────────────────────────────────

/** Item_Type (Feuille 1) → itemtype GLPI géré par l'import. */
export const TYPES_ITEM: Record<string, 'Computer' | 'Monitor'> = {
  computer: 'Computer',
  ordinateur: 'Computer',
  monitor: 'Monitor',
  moniteur: 'Monitor',
  ecran: 'Monitor',
  écran: 'Monitor',
}

/** Type de ticket → code GLPI (1 = Incident, 2 = Demande). */
export const TYPES_TICKET: Record<string, number> = {
  incident: 1,
  request: 2,
  demande: 2,
  demand: 2,
}

/** Statut de ticket → code GLPI. */
export const STATUTS_TICKET: Record<string, number> = {
  new: 1,
  nouveau: 1,
  assigned: 2,
  'en cours (attribué)': 2,
  attribue: 2,
  planned: 3,
  'en cours (planifié)': 3,
  planifie: 3,
  pending: 4,
  'en attente': 4,
  solved: 5,
  resolu: 5,
  closed: 6,
  clos: 6,
  ferme: 6,
}

/** Priorité de ticket → code GLPI (1..5). */
export const PRIORITES_TICKET: Record<string, number> = {
  '1': 1,
  'very low': 1,
  'très basse': 1,
  'tres basse': 1,
  '2': 2,
  low: 2,
  basse: 2,
  '3': 3,
  medium: 3,
  moyenne: 3,
  '4': 4,
  high: 4,
  haute: 4,
  '5': 5,
  'very high': 5,
  'très haute': 5,
  'tres haute': 5,
}

/** Normalise une clé de correspondance (minuscule, espaces compactés). */
export function normaliser(valeur: string): string {
  return valeur.trim().toLowerCase().replace(/\s+/g, ' ')
}

// ─── Schémas des fichiers ────────────────────────────────────────────────────

export const SCHEMA_INVENTAIRE: FichierSchema = {
  id: 'inventaire',
  libelle: 'Feuille 1 (Inventaire)',
  colonnes: [
    { nom: 'Name', regle: 'texte' },
    { nom: 'Status', regle: 'texte' },
    { nom: 'Location', regle: 'texte' },
    { nom: 'Manufacturer', regle: 'texte' },
    { nom: 'Item_Type', regle: 'enum', correspondances: TYPES_ITEM },
    { nom: 'Model', regle: 'texte' },
    { nom: 'Inventory_Number', regle: 'texte-optionnel' },
    { nom: 'User', regle: 'texte-optionnel' },
  ],
}

export const SCHEMA_TICKETS: FichierSchema = {
  id: 'tickets',
  libelle: 'Feuille 2 (Tickets)',
  colonnes: [
    { nom: 'Ref_Ticket', regle: 'entier' },
    { nom: 'Date', regle: 'date-ddmmyyyy' },
    { nom: 'Heure', regle: 'heure-hhmm' },
    { nom: 'Type', regle: 'enum', correspondances: TYPES_TICKET },
    { nom: 'Titre', regle: 'texte' },
    { nom: 'Description', regle: 'texte' },
    { nom: 'Status', regle: 'enum', correspondances: STATUTS_TICKET },
    { nom: 'Priority', regle: 'enum', correspondances: PRIORITES_TICKET },
    { nom: 'Items', regle: 'json-array' },
  ],
}

export const SCHEMA_COUTS: FichierSchema = {
  id: 'couts',
  libelle: 'Feuille 3 (Coûts)',
  colonnes: [
    { nom: 'Num_Ticket', regle: 'entier' },
    { nom: 'Duration_second', regle: 'entier' },
    { nom: 'Time_Cost', regle: 'nombre-fr' },
    { nom: 'Fixed_Cost', regle: 'nombre-fr' },
  ],
}

export const SCHEMAS: Record<FichierId, FichierSchema> = {
  inventaire: SCHEMA_INVENTAIRE,
  tickets: SCHEMA_TICKETS,
  couts: SCHEMA_COUTS,
}
