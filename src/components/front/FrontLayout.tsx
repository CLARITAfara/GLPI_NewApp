import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { path: '/front', label: '📦 Éléments', exact: true },
  { path: '/front/tickets/create', label: '🎫 Créer un ticket', exact: false },
]

export function FrontLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (!session) return null

  const displayName = session.friendly_name || session.name

  return (
    <div className="front-wrap">
      <header className="front-header">
        <div className="front-brand">
          <span className="front-brand-icon" aria-hidden="true">📦</span>
          <span className="front-brand-name">Espace utilisateur</span>
        </div>
        <div className="front-user">
          <span className="front-avatar">{displayName.charAt(0).toUpperCase()}</span>
          <span className="front-username">{displayName}</span>
          <button type="button" className="front-logout" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </header>

      <nav className="front-page-nav">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              type="button"
              className={`front-nav-item${active ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <main className="front-main">
        <Outlet />
      </main>
    </div>
  )
}
