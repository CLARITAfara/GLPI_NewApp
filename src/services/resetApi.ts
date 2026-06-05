import { fetchAllIds, fetchCount, supprimerItem } from './glpiApi'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EndpointConfig {
  endpoint: string
  label: string
  /**
   * true pour les ressources sans corbeille (dropdowns : Location, State,
   * Manufacturer…) : elles n'ont pas de champ is_deleted, on n'applique donc
   * pas le filtre is_deleted==false (sinon erreur RSQL).
   */
  sansCorbeille?: boolean
}

export interface ModuleReset {
  id: string
  label: string
  icone: string
  description: string
  endpoints: EndpointConfig[]
}

export interface EchecSuppression {
  /** Label de l'endpoint concerné (ex. "Tickets") */
  endpoint: string
  /** 0 si c'est une erreur de listing (impossible de récupérer les IDs) */
  id: number
  erreur: string
}

export interface ResultatModule {
  moduleId: string
  label: string
  supprimes: number
  echecs: EchecSuppression[]
}

export interface ProgressionModule {
  total: number
  traites: number
  /** Nombre réellement supprimés (hors échecs), renseigné en fin de module. */
  supprimes?: number
}

// ─── Catalogue des modules ───────────────────────────────────────────────────

export const MODULES_DISPONIBLES: ModuleReset[] = [
  {
    id: 'assistance',
    label: 'Assistance',
    icone: '🎫',
    description: 'Tickets, changements et problèmes',
    endpoints: [
      { endpoint: '/Assistance/Ticket', label: 'Tickets' },
      { endpoint: '/Assistance/Change', label: 'Changements' },
      { endpoint: '/Assistance/Problem', label: 'Problèmes' },
    ],
  },
  {
    id: 'parc',
    label: 'Parc matériel',
    icone: '💻',
    description: 'Ordinateurs, écrans, imprimantes et périphériques',
    endpoints: [
      { endpoint: '/Assets/Computer', label: 'Ordinateurs' },
      { endpoint: '/Assets/Monitor', label: 'Moniteurs' },
      { endpoint: '/Assets/NetworkEquipment', label: 'Équipements réseau' },
      { endpoint: '/Assets/Printer', label: 'Imprimantes' },
      { endpoint: '/Assets/Phone', label: 'Téléphones' },
      { endpoint: '/Assets/Peripheral', label: 'Périphériques' },
      { endpoint: '/Assets/Unmanaged', label: 'Non gérés' },
      { endpoint: '/Assets/Appliance', label: 'Applications' },
      { endpoint: '/Assets/Cable', label: 'Câbles' },
      { endpoint: '/Assets/Rack', label: 'Baies' },
      { endpoint: '/Assets/Enclosure', label: 'Châssis' },
      { endpoint: '/Assets/PDU', label: 'PDU' },
    ],
  },
  {
    id: 'logiciels',
    label: 'Logiciels',
    icone: '📦',
    description: 'Logiciels installés et licences',
    endpoints: [
      { endpoint: '/Assets/Software', label: 'Logiciels' },
      { endpoint: '/Assets/SoftwareLicense', label: 'Licences' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    icone: '📋',
    description: 'Contrats, fournisseurs, contacts, documents et budgets',
    endpoints: [
      { endpoint: '/Management/Contract', label: 'Contrats' },
      { endpoint: '/Management/Contact', label: 'Contacts' },
      { endpoint: '/Management/Supplier', label: 'Fournisseurs' },
      { endpoint: '/Management/Document', label: 'Documents' },
      { endpoint: '/Management/Budget', label: 'Budgets' },
      { endpoint: '/Management/Domain', label: 'Domaines' },
      { endpoint: '/Management/Line', label: 'Lignes' },
      { endpoint: '/Management/License', label: 'Licences commerciales' },
    ],
  },
  {
    id: 'knowledgebase',
    label: 'Base de connaissances',
    icone: '📚',
    description: 'Articles de la base de connaissances',
    endpoints: [
      { endpoint: '/Knowledgebase/Article', label: 'Articles' },
    ],
  },
  {
    id: 'projets',
    label: 'Projets',
    icone: '📁',
    description: 'Tâches de projet',
    endpoints: [
      { endpoint: '/Project/Task', label: 'Tâches' },
    ],
  },
  {
    id: 'journaux',
    label: 'Journaux',
    icone: '📝',
    description: 'Événements et logs système',
    endpoints: [
      { endpoint: '/Administration/EventLog', label: 'Événements' },
    ],
  },
]

/**
 * Modules réellement proposés à la réinitialisation dans l'UI : un module
 * distinct par type de ressource alimenté par les imports Excel/CSV.
 */
export const MODULES_RESET: ModuleReset[] = [
  {
    id: 'tickets',
    label: 'Tickets',
    icone: '🎫',
    description: 'Tickets importés (avec leurs coûts et liens d\'objets)',
    endpoints: [{ endpoint: '/Assistance/Ticket', label: 'Tickets' }],
  },
  {
    id: 'ordinateurs',
    label: 'Ordinateurs',
    icone: '💻',
    description: 'Ordinateurs de l\'inventaire (Item_Type = Computer)',
    endpoints: [{ endpoint: '/Assets/Computer', label: 'Ordinateurs' }],
  },
  {
    id: 'moniteurs',
    label: 'Moniteurs',
    icone: '🖥️',
    description: 'Moniteurs de l\'inventaire (Item_Type = Monitor)',
    endpoints: [{ endpoint: '/Assets/Monitor', label: 'Moniteurs' }],
  },
  {
    id: 'utilisateurs',
    label: 'Utilisateurs',
    icone: '👤',
    description: 'Utilisateurs (colonne User de l\'inventaire)',
    endpoints: [{ endpoint: '/Administration/User', label: 'Utilisateurs' }],
  },
  {
    id: 'localisations',
    label: 'Localisations',
    icone: '📍',
    description: 'Localisations (colonne Location)',
    endpoints: [
      { endpoint: '/Dropdowns/Location', label: 'Localisations', sansCorbeille: true },
    ],
  },
  {
    id: 'statuts',
    label: 'Statuts',
    icone: '🏷️',
    description: 'Statuts (colonne Status : En production, Maintenance…)',
    endpoints: [
      { endpoint: '/Dropdowns/State', label: 'Statuts', sansCorbeille: true },
    ],
  },
  {
    id: 'fabricants',
    label: 'Fabricants',
    icone: '🏭',
    description: 'Fabricants (colonne Manufacturer : Dell, HP, Lenovo)',
    endpoints: [
      { endpoint: '/Dropdowns/Manufacturer', label: 'Fabricants', sansCorbeille: true },
    ],
  },
]

/** Comptage d'un endpoint : nombre d'enregistrements, ou null si erreur. */
export type CompteursEndpoints = Record<string, number | null>

/**
 * Récupère, via l'API GLPI directe, le nombre d'enregistrements en base
 * pour chaque endpoint des modules fournis. Clé = chemin de l'endpoint.
 */
export async function compterEndpoints(
  modules: ModuleReset[],
): Promise<CompteursEndpoints> {
  const compteurs: CompteursEndpoints = {}
  for (const m of modules) {
    for (const ep of m.endpoints) {
      try {
        // Exclut la corbeille par défaut ; dropdowns = pas de is_deleted.
        compteurs[ep.endpoint] = await fetchCount(ep.endpoint, {
          includeDeleted: ep.sansCorbeille,
        })
      } catch {
        compteurs[ep.endpoint] = null
      }
    }
  }
  return compteurs
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function reinitialiserModule(
  module: ModuleReset,
  onProgression?: (p: ProgressionModule) => void,
): Promise<ResultatModule> {
  const collected: Array<{ ep: EndpointConfig; ids: number[] }> = []
  const echecs: EchecSuppression[] = []

  for (const ep of module.endpoints) {
    try {
      const ids = await fetchAllIds(ep.endpoint, { includeDeleted: ep.sansCorbeille })
      collected.push({ ep, ids })
    } catch (err) {
      echecs.push({
        endpoint: ep.label,
        id: 0,
        erreur: `Listing impossible — ${err instanceof Error ? err.message : String(err)}`,
      })
      collected.push({ ep, ids: [] })
    }
  }

  const total = collected.reduce((s, c) => s + c.ids.length, 0)
  let traites = 0
  onProgression?.({ total, traites })

  for (const { ep, ids } of collected) {
    for (const id of ids) {
      try {
        await supprimerItem(ep.endpoint, id)
      } catch (err) {
        echecs.push({
          endpoint: ep.label,
          id,
          erreur: err instanceof Error ? err.message : String(err),
        })
      }
      traites++
      onProgression?.({ total, traites })
    }
  }

  return {
    moduleId: module.id,
    label: module.label,
    supprimes: traites - echecs.filter((e) => e.id > 0).length,
    echecs,
  }
}

/**
 * Réinitialise tous les modules sélectionnés séquentiellement.
 * Ne lève jamais d'erreur : les échecs sont inclus dans le rapport.
 */
export async function reinitialiser(
  modules: ModuleReset[],
  onProgression?: (moduleId: string, p: ProgressionModule) => void,
): Promise<ResultatModule[]> {
  const resultats: ResultatModule[] = []

  for (const module of modules) {
    try {
      const resultat = await reinitialiserModule(module, (p) =>
        onProgression?.(module.id, p),
      )
      resultats.push(resultat)
    } catch (err) {
      resultats.push({
        moduleId: module.id,
        label: module.label,
        supprimes: 0,
        echecs: [{
          endpoint: module.label,
          id: 0,
          erreur: err instanceof Error ? err.message : String(err),
        }],
      })
      onProgression?.(module.id, { total: 0, traites: 0 })
    }
  }

  return resultats
}
