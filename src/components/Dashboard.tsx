import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sectionsForRole } from '../sections'
import { SectionView } from './SectionView'
import { ResetPanel } from './ResetPanel'
import { ImportPanel } from './ImportPanel'
import { StatsView } from './StatsView'
import { TicketsView } from './TicketsView'
import { Sidebar } from './Sidebar'
import { KanbanConfigPanel } from './KanbanConfigPanel'

// Libellés FR des profils GLPI
const ROLE_LABELS: Record<string, string> = {
  'Super-Admin': 'Super-administrateur',
  Admin: 'Administrateur',
  Technician: 'Technicien',
  Observer: 'Observateur',
  'Self-Service': 'Libre-service',
  Hotliner: 'Hotliner',
  Supervisor: 'Superviseur',
  'Read-Only': 'Lecture seule',
}

export function Dashboard() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const { section: sectionParam } = useParams()

  const role = session?.active_profile?.name ?? '—'
  const iface = session?.active_profile?.interface ?? ''
  const sections = useMemo(() => sectionsForRole(role, iface), [role, iface])

  // L'onglet actif est dérivé de l'URL (/:section). À défaut (« / ») ou si la
  // section est inconnue/non autorisée, on retombe sur la première section.
  const active = sections.find((s) => s.id === sectionParam) ?? sections[0]

  // URL invalide (section inexistante pour ce rôle) → on normalise vers la racine.
  useEffect(() => {
    if (sectionParam && !sections.some((s) => s.id === sectionParam)) {
      navigate('/', { replace: true })
    }
  }, [sectionParam, sections, navigate])

  if (!session) return null

  const roleLabel = ROLE_LABELS[role] ?? role
  const displayName = session.friendly_name || session.name

  return (
    <div className="app-shell">
      <Sidebar
        brandIcon="🛠️"
        brandName="GLPI Admin"
        brandSubtitle="Back-office"
        items={sections.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
        activeId={active?.id}
        onSelect={(id) => navigate(`/${id}`)}
        footer={
          <>
            <div className="sidebar-user">
              <span className="avatar">{displayName.charAt(0).toUpperCase()}</span>
              <div className="sidebar-user-info">
                <strong title={displayName}>{displayName}</strong>
                <span className={`role-badge role-${iface}`}>{roleLabel}</span>
              </div>
            </div>
            <button type="button" className="btn-ghost btn-block" onClick={() => navigate('/front')}>
              Espace utilisateur
            </button>
            <button type="button" className="btn-ghost btn-block" onClick={logout}>
              Se déconnecter
            </button>
          </>
        }
      />

      <div className="app-content">
        <main className="dash-main">
          {active?.custom === 'stats' ? (
            <StatsView />
          ) : active?.custom === 'tickets' ? (
            <TicketsView />
          ) : active?.custom === 'kanban' ? (
            <KanbanConfigPanel />
          ) : active?.custom === 'reset' ? (
            <ResetPanel />
          ) : active?.custom === 'import' ? (
            <ImportPanel />
          ) : active ? (
            <SectionView key={active.id} section={active} />
          ) : (
            <p className="muted">Aucune section disponible pour ce rôle.</p>
          )}
        </main>
      </div>
    </div>
  )
}
