import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { sectionsForRole } from '../sections'
import { SectionView } from './SectionView'

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

  const role = session?.active_profile?.name ?? '—'
  const iface = session?.active_profile?.interface ?? ''
  const sections = useMemo(() => sectionsForRole(role, iface), [role, iface])
  const [activeId, setActiveId] = useState(sections[0]?.id)

  if (!session) return null

  const roleLabel = ROLE_LABELS[role] ?? role
  const active = sections.find((s) => s.id === activeId) ?? sections[0]
  const displayName = session.friendly_name || session.name

  return (
    <div className="dash-wrap">
      <header className="dash-header">
        <div className="dash-user">
          <span className="avatar">{displayName.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{displayName}</strong>
            <span className={`role-badge role-${iface}`}>{roleLabel}</span>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={logout}>
          Se déconnecter
        </button>
      </header>

      <div className="dash-body">
        <nav className="dash-nav">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active?.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveId(s.id)}
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <main className="dash-main">
          {active ? (
            <SectionView key={active.id} section={active} />
          ) : (
            <p className="muted">Aucune section disponible pour ce rôle.</p>
          )}
        </main>
      </div>
    </div>
  )
}
