import { useAuth } from '../../context/AuthContext'
import { ElementsPanel } from './ElementsPanel'

export function FrontDashboard() {
  const { session, logout } = useAuth()

  if (!session) return null

  const displayName = session.friendly_name || session.name

  return (
    <div className="front-wrap">
      <header className="front-header">
        <div className="front-brand">
        <span className="front-brand-icon" aria-hidden="true">
          <i className="bi bi-box-seam" aria-hidden="true" />
        </span>
        </div>

        <div className="front-user">
          <span className="front-avatar">{displayName.charAt(0).toUpperCase()}</span>
          <span className="front-username">{displayName}</span>
          <button type="button" className="front-logout" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="front-main">
        <ElementsPanel />
      </main>
    </div>
  )
}
