import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, type SidebarNavItem } from '../Sidebar'

const NAV = [
  { path: '/front', icon: 'bi bi-box-seam', label: 'Éléments', exact: true },
  { path: '/front/tickets/create', icon: 'bi bi-ticket-detailed', label: 'Créer un ticket', exact: false },
]

export function FrontLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="front-wrap">
      <header className="front-header">
        <div className="front-brand">
          <span className="front-brand-icon" aria-hidden="true">
            <i className="bi bi-box-seam" />
          </span>
          <span className="front-brand-name">Espace utilisateur</span>
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
              <i className={`${item.icon} me-2`} aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="app-content">
        <main className="front-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
