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
  <div className="dash-wrap">
    <header className="dash-header">
      <div className="header-left">
        <div className="brand">
          <img
            src="/logo-glpi.png"
            alt="GLPI"
            className="brand-logo"
          />

          <div className="brand-info">
            <strong>GLPI Manager</strong>
            <span>{roleLabel}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="dash-user-card">
          <div className="avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div className="user-info">
            <strong>{displayName}</strong>

            <span className={`role-badge role-${iface}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => navigate('/front')}
        >
          Espace utilisateur
        </button>

        <button
          type="button"
          className="btn btn-outline-danger"
          onClick={logout}
        >
          Déconnexion
        </button>
      </div>
    </header>

    <div className="dash-body">
      <aside className="dash-nav">
        <div className="nav-title">
          Navigation
        </div>

        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={
              s.id === active?.id
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() => setActiveId(s.id)}
          >
            <span className="nav-icon">
              <i className={s.icon} aria-hidden="true" />
            </span>

            <span className="nav-label">
              {s.label}
            </span>
          </button>
        ))}
      </aside>

      <main className="dash-main">
        <div className="container-fluid px-0">
          {active?.custom === 'stats' ? (
            <StatsView />
          ) : active?.custom === 'tickets' ? (
            <TicketsView />
          ) : active?.custom === 'reset' ? (
            <ResetPanel />
          ) : active?.custom === 'import' ? (
            <ImportPanel />
          ) : active ? (
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <SectionView
                  key={active.id}
                  section={active}
                />
              </div>
            </div>
          ) : (
            <div className="alert alert-warning">
              Aucune section disponible pour ce rôle.
            </div>
          )}
        </div>
      </main>
    </div>
  </div>
)
}
