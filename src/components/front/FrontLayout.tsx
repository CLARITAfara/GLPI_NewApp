import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, type SidebarNavItem } from '../Sidebar'

/**
 * Navigation du front-office (libre-service), regroupée par thème pour une
 * hiérarchie claire. Les `id` sont des chemins ABSOLUS depuis la racine `/`
 * (le front-office est désormais le point d'entrée par défaut de l'app).
 */
const NAV: SidebarNavItem[] = [
  { id: '/', label: 'Mes éléments', icon: 'bi bi-box-seam', group: 'Navigation' },
  { id: '/kanban', label: 'Tableau Kanban', icon: 'bi bi-kanban', group: 'Tickets' },
  { id: '/tickets/create', label: 'Nouveau ticket', icon: 'bi bi-plus-square', group: 'Tickets' },
  { id: '/couts', label: 'Coûts matériel', icon: 'bi bi-cash-coin', group: 'Tickets' },
  { id: '/couts/edition', label: 'Édition des coûts', icon: 'bi bi-pencil-square', group: 'Tickets' },
  { id: '/import', label: 'Import CSV', icon: 'bi bi-upload', group: 'Tickets' },
]

/** Titre + sous-titre de la barre d'accueil selon la page courante. */
const PAGE_INTRO: Record<string, { titre: string; sous: string }> = {
  '/': { titre: 'Bienvenue dans votre espace', sous: 'Consultez et filtrez votre parc en libre-service.' },
  '/kanban': { titre: 'Suivi des tickets', sous: 'Glissez les cartes pour faire avancer vos demandes.' },
  '/tickets/create': { titre: 'Nouveau ticket', sous: 'Décrivez votre besoin, on s’occupe du reste.' },
  '/couts': { titre: 'Coûts par matériel', sous: 'Total des coûts dépensés par type d’équipement.' },
  '/couts/edition': { titre: 'Édition des coûts', sous: 'Modifiez une réouverture ou un supercost ; les totaux sont recalculés.' },
  '/import': { titre: 'Import des mouvements', sous: 'Rejouez réouvertures, annulations et clôtures depuis un CSV.' },
}

export function FrontLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Item actif : chemin le plus spécifique préfixant l'URL (parcours inversé
  // pour que « /tickets/create » l'emporte sur « / » qui préfixe tout).
  const activeId =
    [...NAV].reverse().find((n) => (n.id === '/' ? pathname === '/' : pathname.startsWith(n.id)))?.id ?? '/'

  const intro = PAGE_INTRO[activeId] ?? PAGE_INTRO['/']

  return (
    <div className="app-shell">
      <Sidebar
        brandIcon="bi bi-box-seam"
        brandName="GLPI · Espace"
        brandSubtitle="Libre-service"
        items={NAV}
        activeId={activeId}
        onSelect={(id) => navigate(id)}
        footer={
          <>
            {/* Raccourci de création toujours accessible */}
            <Link to="/tickets/create" className="btn-primary btn-block front-cta">
              <i className="bi bi-plus-lg" aria-hidden="true" /> Créer un ticket
            </Link>
            {/* Lien d'accès au back-office (login administrateur) */}
            <button
              type="button"
              className="btn-ghost btn-block"
              onClick={() => navigate('/login')}
            >
              <i className="bi bi-shield-lock" aria-hidden="true" /> Accès administrateur
            </button>
            <p className="front-foot-note">Besoin d’aide ? Ouvrez un ticket.</p>
          </>
        }
      />

      <div className="app-content">
        {/* Barre d'accueil : message contextuel + accès admin redondant (desktop) */}
        <header className="front-topbar">
          <div className="front-topbar-text">
            <strong>{intro.titre}</strong>
            <span>{intro.sous}</span>
          </div>
          <div className="front-topbar-actions">
            <Link to="/tickets/create" className="btn-primary front-topbar-cta">
              <i className="bi bi-plus-lg" aria-hidden="true" /> Nouveau ticket
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/login')}
              title="Connexion administrateur"
            >
              <i className="bi bi-shield-lock" aria-hidden="true" /> Admin
            </button>
          </div>
        </header>

        <main className="front-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
