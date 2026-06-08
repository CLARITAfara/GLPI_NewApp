import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { path: '/front', label: '📦 Éléments', exact: true },
  { path: '/front/tickets/create', label: '🎫 Créer un ticket', exact: false },
]

export function FrontLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="front-wrap">
      <header className="front-header">
        <div className="front-brand">
          <span className="front-brand-icon" aria-hidden="true">📦</span>
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
