import { fetchAllIds, supprimerItem } from './glpiApi'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EndpointConfig {
  endpoint: string
  label: string
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

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function reinitialiserModule(
  module: ModuleReset,
  onProgression?: (p: ProgressionModule) => void,
): Promise<ResultatModule> {
  const collected: Array<{ ep: EndpointConfig; ids: number[] }> = []
  const echecs: EchecSuppression[] = []

  for (const ep of module.endpoints) {
    try {
      const ids = await fetchAllIds(ep.endpoint)
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
