import type { GlpiRow } from './services/glpiApi'
import { refName } from './services/glpiApi'
import { formatDate } from './format'

export interface Column {
  key: string
  label: string
  /** Rendu personnalisé (objets liés, dates, libellés…) */
  accessor?: (row: GlpiRow) => string
}

/** Regroupement logique des sections dans la barre latérale. */
export type SectionGroup = 'Pilotage' | 'Assistance' | 'Inventaire' | 'Administration'

export interface Section {
  id: string
  label: string
  icon: string
  /** Endpoint de l'API GLPI (sans le préfixe /api) */
  endpoint: string
  columns: Column[]
  /** Section spéciale sans tableau de données */
  custom?: 'reset' | 'import' | 'stats' | 'tickets' | 'kanban'
  /** Groupe de navigation (en-tête de section dans la sidebar). */
  group: SectionGroup
  /** Action destructive : mise en avant visuelle distincte (rouge). */
  danger?: boolean
}

const STATS: Section = {
  id: 'stats',
  label: "Vue d'ensemble",
  icon: 'bi bi-speedometer2',
  endpoint: '',
  columns: [],
  custom: 'stats',
  group: 'Pilotage',
}

const TICKETS: Section = {
  id: 'tickets',
  label: 'Tickets',
  icon: 'bi bi-ticket-detailed',
  endpoint: '/Assistance/Ticket',
  columns: [],
  custom: 'tickets',
  group: 'Assistance',
}

const KANBAN: Section = {
  id: 'kanban',
  label: 'Kanban',
  icon: 'bi bi-kanban',
  endpoint: '',
  columns: [],
  custom: 'kanban',
  group: 'Assistance',
}

const COMPUTERS: Section = {
  id: 'computers',
  label: 'Ordinateurs',
  icon: 'bi bi-pc-display',
  endpoint: '/Assets/Computer',
  group: 'Inventaire',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'serial', label: 'N° de série', accessor: (r) => refName(r.serial) },
    { key: 'status', label: 'Statut', accessor: (r) => refName(r.status) },
    { key: 'entity', label: 'Entité', accessor: (r) => refName(r.entity) },
  ],
}

const USERS: Section = {
  id: 'users',
  label: 'Utilisateurs',
  icon: 'bi bi-people',
  endpoint: '/Administration/User',
  group: 'Inventaire',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'username', label: 'Identifiant' },
    { key: 'realname', label: 'Nom', accessor: (r) => refName(r.realname) },
    { key: 'is_active', label: 'Actif', accessor: (r) => (r.is_active ? 'Oui' : 'Non') },
    { key: 'last_login', label: 'Dernière connexion', accessor: (r) => formatDate(r.last_login) },
  ],
}

const IMPORT: Section = {
  id: 'import',
  label: 'Import CSV',
  icon: 'bi bi-upload',
  endpoint: '',
  columns: [],
  custom: 'import',
  group: 'Administration',
}

const RESET: Section = {
  id: 'reset',
  label: 'Réinitialisation',
  icon: 'bi bi-trash',
  endpoint: '',
  columns: [],
  custom: 'reset',
  group: 'Administration',
  danger: true,
}

/**
 * Sections visibles selon le rôle.
 * - interface "helpdesk" (libre-service) : seulement ses tickets.
 * - profils d'administration : tout, y compris les utilisateurs.
 * - autres profils "central" (tech, observateur…) : tickets + ordinateurs.
 */
export function sectionsForRole(profileName: string, iface: string): Section[] {
  if (iface === 'helpdesk') {
    return [{ ...TICKETS, label: 'Mes tickets' }]
  }
  switch (profileName) {
    case 'Super-Admin':
    case 'Admin':
    case 'Supervisor':
      return [STATS, TICKETS, KANBAN, COMPUTERS, USERS, IMPORT, RESET]
    default:
      return [STATS, TICKETS, COMPUTERS]
  }
}
