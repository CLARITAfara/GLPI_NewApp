import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, type SidebarNavItem } from '../Sidebar'

const NAV: SidebarNavItem[] = [
  { id: '/front', label: 'Éléments', icon: '📦' },
  { id: '/front/kanban', label: 'Tickets (Kanban)', icon: '🗂️' },
  { id: '/front/tickets/create', label: 'Créer un ticket', icon: '🎫' },
]

export function FrontLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Item actif : on prend le chemin le plus spécifique qui préfixe l'URL
  // (parcours inversé pour que « /front/tickets/create » l'emporte sur « /front »).
  const activeId =
    [...NAV].reverse().find((n) => pathname.startsWith(n.id))?.id ?? '/front'

  return (
    <div className="app-shell">
      <Sidebar
        brandIcon="📦"
        brandName="Espace utilisateur"
        items={NAV}
        activeId={activeId}
        onSelect={(id) => navigate(id)}
      />

      <div className="app-content">
        <main className="front-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
