import type { GlpiRow } from './api/glpi'
import { refName } from './api/glpi'
import { formatDate } from './format'

export interface Column {
  key: string
  label: string
  /** Rendu personnalisé (objets liés, dates, libellés…) */
  accessor?: (row: GlpiRow) => string
}

export interface Section {
  id: string
  label: string
  icon: string
  /** Endpoint de l'API GLPI (sans le préfixe /api) */
  endpoint: string
  columns: Column[]
}

const PRIORITY: Record<number, string> = {
  1: 'Très basse',
  2: 'Basse',
  3: 'Moyenne',
  4: 'Haute',
  5: 'Très haute',
  6: 'Majeure',
}

const TICKETS: Section = {
  id: 'tickets',
  label: 'Tickets',
  icon: '🎫',
  endpoint: '/Assistance/Ticket',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Titre' },
    { key: 'status', label: 'Statut', accessor: (r) => refName(r.status) },
    { key: 'priority', label: 'Priorité', accessor: (r) => PRIORITY[Number(r.priority)] ?? refName(r.priority) },
    { key: 'date_creation', label: 'Créé le', accessor: (r) => formatDate(r.date_creation) },
  ],
}

const COMPUTERS: Section = {
  id: 'computers',
  label: 'Ordinateurs',
  icon: '💻',
  endpoint: '/Assets/Computer',
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
  icon: '👤',
  endpoint: '/Administration/User',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'username', label: 'Identifiant' },
    { key: 'realname', label: 'Nom', accessor: (r) => refName(r.realname) },
    { key: 'is_active', label: 'Actif', accessor: (r) => (r.is_active ? 'Oui' : 'Non') },
    { key: 'last_login', label: 'Dernière connexion', accessor: (r) => formatDate(r.last_login) },
  ],
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
      return [TICKETS, COMPUTERS, USERS]
    default:
      return [TICKETS, COMPUTERS]
  }
}
