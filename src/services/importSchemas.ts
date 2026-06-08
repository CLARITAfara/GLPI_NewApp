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
  | 'Rack'
  | 'Enclosure'
  | 'PDU'
  | 'PassiveDCEquipment'
  | 'Software'
  | 'SoftwareLicense'
  | 'Certificate'
  | 'Cable'
  | 'Socket'
  | 'Appliance'

/** Champs partagés (listes déroulantes / utilisateur) qu'un type accepte. */
export type ChampPartage = 'location' | 'manufacturer' | 'user' | 'otherserial'

export interface ItemTypeConfig {
  itemType: ItemType
  /** Endpoint High-Level de l'asset (liste / création). */
  assetEndpoint: string
  /**
   * Endpoint High-Level du modèle associé (Dropdown). Absent quand GLPI
   * n'expose pas de route de modèle (Rack, PDU, Socket…) : modèle ignoré.
   */
  modelEndpoint?: string
  /**
   * Nom du champ « statut » : `status` (assets standards), `state` (datacenter)
   * ou absent (Software, Socket : pas de statut). Pointe vers le dropdown State.
   */
  statusField?: 'status' | 'state'
  /** Champs partagés réellement supportés par ce type. */
  champs: ChampPartage[]
  /** true si le type n'a PAS de corbeille (champ is_deleted absent : Socket). */
  sansCorbeille?: boolean
  /**
   * false si GLPI n'autorise pas l'association de ce type à un ticket
   * (relation Item_Ticket). Le lien Items→ticket est alors ignoré proprement
   * au lieu de produire une erreur 500. Par défaut (absent) : associable.
   */
  associableTicket?: boolean
  /**
   * Nom de classe GLPI à employer comme `itemtype` dans Item_Ticket / les API
   * legacy, quand il diffère de la clé interne. Ex. Socket → `Glpi\Socket`
   * (classe avec namespace). Par défaut (absent) : identique à `itemType`.
   */
  ticketItemtype?: string
  /** Pictogramme affiché dans l'UI. */
  icone: string
  /** Libellé FR (pluriel) affiché dans l'UI (réinitialisation, rapports…). */
  libelle: string
}

const CHAMPS_STD: ChampPartage[] = ['location', 'manufacturer', 'user', 'otherserial']

/**
 * Registre des itemtypes gérés → endpoints + champs + icône + libellé.
 * Chaque type ne déclare que les champs que son schéma GLPI accepte réellement
 * (vérifié sur l'OpenAPI) ; les champs CSV non pertinents sont ignorés.
 */
export const ITEM_TYPES: Record<ItemType, ItemTypeConfig> = {
  Computer: { itemType: 'Computer', assetEndpoint: '/Assets/Computer', modelEndpoint: '/Dropdowns/ComputerModel', statusField: 'status', champs: CHAMPS_STD, icone: '💻', libelle: 'Ordinateurs' },
  Monitor: { itemType: 'Monitor', assetEndpoint: '/Assets/Monitor', modelEndpoint: '/Dropdowns/MonitorModel', statusField: 'status', champs: CHAMPS_STD, icone: '🖥️', libelle: 'Moniteurs' },
  NetworkEquipment: { itemType: 'NetworkEquipment', assetEndpoint: '/Assets/NetworkEquipment', modelEndpoint: '/Dropdowns/NetworkEquipmentModel', statusField: 'status', champs: CHAMPS_STD, icone: '🌐', libelle: 'Équipements réseau' },
  Peripheral: { itemType: 'Peripheral', assetEndpoint: '/Assets/Peripheral', modelEndpoint: '/Dropdowns/PeripheralModel', statusField: 'status', champs: CHAMPS_STD, icone: '🖱️', libelle: 'Périphériques' },
  Phone: { itemType: 'Phone', assetEndpoint: '/Assets/Phone', modelEndpoint: '/Dropdowns/PhoneModel', statusField: 'status', champs: CHAMPS_STD, icone: '📱', libelle: 'Téléphones' },
  Printer: { itemType: 'Printer', assetEndpoint: '/Assets/Printer', modelEndpoint: '/Dropdowns/PrinterModel', statusField: 'status', champs: CHAMPS_STD, icone: '🖨️', libelle: 'Imprimantes' },
  // Datacenter : statut = `state`. Seul Enclosure a un Dropdown de modèle.
  Rack: { itemType: 'Rack', assetEndpoint: '/Assets/Rack', statusField: 'state', champs: CHAMPS_STD, icone: '🗄️', libelle: 'Baies' },
  Enclosure: { itemType: 'Enclosure', assetEndpoint: '/Assets/Enclosure', modelEndpoint: '/Dropdowns/EnclosureModel', statusField: 'state', champs: CHAMPS_STD, icone: '📦', libelle: 'Châssis' },
  PDU: { itemType: 'PDU', assetEndpoint: '/Assets/PDU', statusField: 'state', champs: CHAMPS_STD, icone: '🔌', libelle: 'Bandeaux PDU' },
  PassiveDCEquipment: { itemType: 'PassiveDCEquipment', assetEndpoint: '/Assets/PassiveDCEquipment', statusField: 'state', champs: CHAMPS_STD, icone: '🔧', libelle: 'Équipements passifs' },
  // Types « non-inventaire » : champs restreints à ce que le schéma accepte.
  Software: { itemType: 'Software', assetEndpoint: '/Assets/Software', champs: ['location', 'manufacturer', 'user'], icone: '💿', libelle: 'Logiciels' },
  SoftwareLicense: { itemType: 'SoftwareLicense', assetEndpoint: '/Assets/SoftwareLicense', statusField: 'status', champs: CHAMPS_STD, icone: '🔑', libelle: 'Licences logicielles' },
  Certificate: { itemType: 'Certificate', assetEndpoint: '/Assets/Certificate', statusField: 'status', champs: CHAMPS_STD, icone: '📜', libelle: 'Certificats' },
  Cable: { itemType: 'Cable', assetEndpoint: '/Assets/Cable', statusField: 'state', champs: ['user', 'otherserial'], icone: '🔗', libelle: 'Câbles' },
  // Socket : classe GLPI namespacée → itemtype `Glpi\Socket` pour Item_Ticket.
  Socket: { itemType: 'Socket', assetEndpoint: '/Assets/Socket', champs: ['location'], sansCorbeille: true, ticketItemtype: 'Glpi\\Socket', icone: 'bi bi-square', libelle: 'Prises' },
  Appliance: { itemType: 'Appliance', assetEndpoint: '/Assets/Appliance', statusField: 'status', champs: CHAMPS_STD, icone: 'bi bi-cloud', libelle: 'Applicatifs' },
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
  // Rack
  rack: 'Rack',
  baie: 'Rack',
  // Enclosure
  enclosure: 'Enclosure',
  chassis: 'Enclosure',
  châssis: 'Enclosure',
  // PDU
  pdu: 'PDU',
  'bandeau de prises': 'PDU',
  // PassiveDCEquipment
  passivedcequipment: 'PassiveDCEquipment',
  'passive dc equipment': 'PassiveDCEquipment',
  'equipement passif': 'PassiveDCEquipment',
  'équipement passif': 'PassiveDCEquipment',
  // Software
  software: 'Software',
  logiciel: 'Software',
  // SoftwareLicense
  softwarelicense: 'SoftwareLicense',
  'software license': 'SoftwareLicense',
  license: 'SoftwareLicense',
  licence: 'SoftwareLicense',
  'licence logicielle': 'SoftwareLicense',
  // Certificate
  certificate: 'Certificate',
  certificat: 'Certificate',
  // Cable
  cable: 'Cable',
  câble: 'Cable',
  // Socket
  socket: 'Socket',
  prise: 'Socket',
  // Appliance
  appliance: 'Appliance',
  applicatif: 'Appliance',
  appareil: 'Appliance',
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
    // Statut/Localisation/Fabricant/Modèle sont optionnels : tous les types ne
    // les exposent pas (ex. Cable n'a ni localisation ni fabricant, Software
    // n'a pas de statut). Le champ est appliqué seulement si le type le
    // supporte ET si une valeur est fournie (cf. ITEM_TYPES).
    { nom: 'Status', regle: 'texte-optionnel' },
    { nom: 'Location', regle: 'texte-optionnel' },
    { nom: 'Manufacturer', regle: 'texte-optionnel' },
    { nom: 'Item_Type', regle: 'enum', correspondances: TYPES_ITEM },
    { nom: 'Model', regle: 'texte-optionnel' },
    { nom: 'Inventory_Number', regle: 'texte-optionnel' },
    { nom: 'User', regle: 'texte-optionnel' },
  ],
}

export const SCHEMA_TICKETS: FichierSchema = {
  id: 'tickets',
  libelle: 'Feuille 2 (Tickets)',
  colonnes: [
    // Référence libre (ex. « TK-001 » ou « 42 ») : sert uniquement de clé de
    // liaison interne entre les Feuilles 2 et 3, jamais envoyée à GLPI.
    { nom: 'Ref_Ticket', regle: 'texte' },
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
    // Doit correspondre à un Ref_Ticket de la Feuille 2 (référence libre).
    { nom: 'Num_Ticket', regle: 'texte' },
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
