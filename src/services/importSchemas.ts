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

// ─── Types de matériel gérés (Feuille 1) ─────────────────────────────────────

/**
 * itemtypes GLPI gérés par l'import. Tous partagent le même jeu de champs
 * (name / status / location / manufacturer / model / otherserial / user) et
 * exposent à la fois un endpoint High-Level d'asset et un Dropdown de modèle.
 */
export type ItemType =
  | 'Computer'
  | 'Monitor'
  | 'NetworkEquipment'
  | 'Peripheral'
  | 'Phone'
  | 'Printer'

export interface ItemTypeConfig {
  itemType: ItemType
  /** Endpoint High-Level de l'asset (liste / création). */
  assetEndpoint: string
  /** Endpoint High-Level du modèle associé (Dropdown). */
  modelEndpoint: string
  /** Pictogramme affiché dans l'UI. */
  icone: string
}

/** Registre des itemtypes gérés → endpoints API + icône. */
export const ITEM_TYPES: Record<ItemType, ItemTypeConfig> = {
  Computer: { itemType: 'Computer', assetEndpoint: '/Assets/Computer', modelEndpoint: '/Dropdowns/ComputerModel', icone: '💻' },
  Monitor: { itemType: 'Monitor', assetEndpoint: '/Assets/Monitor', modelEndpoint: '/Dropdowns/MonitorModel', icone: '🖥️' },
  NetworkEquipment: { itemType: 'NetworkEquipment', assetEndpoint: '/Assets/NetworkEquipment', modelEndpoint: '/Dropdowns/NetworkEquipmentModel', icone: '🌐' },
  Peripheral: { itemType: 'Peripheral', assetEndpoint: '/Assets/Peripheral', modelEndpoint: '/Dropdowns/PeripheralModel', icone: '🖱️' },
  Phone: { itemType: 'Phone', assetEndpoint: '/Assets/Phone', modelEndpoint: '/Dropdowns/PhoneModel', icone: '📱' },
  Printer: { itemType: 'Printer', assetEndpoint: '/Assets/Printer', modelEndpoint: '/Dropdowns/PrinterModel', icone: '🖨️' },
}

// ─── Tables de correspondance ────────────────────────────────────────────────

/**
 * Item_Type (Feuille 1) → itemtype GLPI géré par l'import. Plusieurs libellés
 * (FR/EN, synonymes) pointent vers le même itemtype ; la comparaison est
 * insensible à la casse (cf. `normaliser`).
 */
export const TYPES_ITEM: Record<string, ItemType> = {
  // Computer
  computer: 'Computer',
  ordinateur: 'Computer',
  pc: 'Computer',
  laptop: 'Computer',
  portable: 'Computer',
  server: 'Computer',
  serveur: 'Computer',
  // Monitor
  monitor: 'Monitor',
  moniteur: 'Monitor',
  ecran: 'Monitor',
  écran: 'Monitor',
  screen: 'Monitor',
  // NetworkEquipment
  networkequipment: 'NetworkEquipment',
  'network equipment': 'NetworkEquipment',
  'equipement reseau': 'NetworkEquipment',
  'équipement réseau': 'NetworkEquipment',
  reseau: 'NetworkEquipment',
  réseau: 'NetworkEquipment',
  switch: 'NetworkEquipment',
  router: 'NetworkEquipment',
  routeur: 'NetworkEquipment',
  // Peripheral
  peripheral: 'Peripheral',
  peripherique: 'Peripheral',
  périphérique: 'Peripheral',
  device: 'Peripheral',
  // Phone
  phone: 'Phone',
  telephone: 'Phone',
  téléphone: 'Phone',
  smartphone: 'Phone',
  mobile: 'Phone',
  // Printer
  printer: 'Printer',
  imprimante: 'Printer',
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
  'in progress': 2,
  'en cours': 2,
  'en cours (attribué)': 2,
  attribue: 2,
  planned: 3,
  'en cours (planifié)': 3,
  planifie: 3,
  pending: 4,
  'en attente': 4,
  solved: 5,
  resolved: 5,
  resolu: 5,
  résolu: 5,
  closed: 6,
  clos: 6,
  ferme: 6,
  fermé: 6,
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
  critical: 5,
  critique: 5,
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
