import { useState, type ReactNode } from 'react'

export interface SidebarNavItem {
  id: string
  label: string
  /** Classe d'icône bootstrap-icons (ex. « bi bi-kanban »). */
  icon: string
  /** En-tête de groupe (ex. « Assistance »). Les items consécutifs partageant
   *  le même groupe sont rendus sous un seul libellé. */
  group?: string
  /** Action destructive : style d'alerte (rouge) au survol / actif. */
  danger?: boolean
}

interface SidebarProps {
  /** Classe d'icône bootstrap-icons de la marque. */
  brandIcon: string
  brandName: string
  brandSubtitle?: string
  items: SidebarNavItem[]
  activeId?: string
  onSelect: (id: string) => void
  /** Contenu de bas de sidebar (profil, déconnexion…). */
  footer?: ReactNode
}

/** Regroupe les items par `group` en PRÉSERVANT l'ordre d'apparition.
 *  (On n'utilise pas un simple objet pour ne pas réordonner les groupes.) */
function grouper(items: SidebarNavItem[]): { group: string | undefined; items: SidebarNavItem[] }[] {
  const groupes: { group: string | undefined; items: SidebarNavItem[] }[] = []
  for (const it of items) {
    const dernier = groupes[groupes.length - 1]
    if (dernier && dernier.group === it.group) {
      dernier.items.push(it)
    } else {
      groupes.push({ group: it.group, items: [it] })
    }
  }
  return groupes
}

/**
 * Barre latérale de navigation partagée par le back-office et le front-office.
 * Navigation hiérarchisée : items regroupés sous des en-têtes de section
 * (primaire = groupe, secondaire = item). Fixe sur desktop ; sur mobile, elle
 * se replie en tiroir (drawer) ouvert par un bouton hamburger.
 */
export function Sidebar({
  brandIcon,
  brandName,
  brandSubtitle,
  items,
  activeId,
  onSelect,
  footer,
}: SidebarProps) {
  const [open, setOpen] = useState(false)

  const choisir = (id: string): void => {
    onSelect(id)
    setOpen(false) // referme le tiroir mobile après sélection
  }

  const groupes = grouper(items)

  return (
    <>
      {/* Barre supérieure (mobile uniquement) */}
      <div className="sidebar-topbar">
        <button
          type="button"
          className="sidebar-burger"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="sidebar-topbar-title">
          <i className={brandIcon} aria-hidden="true" /> {brandName}
        </span>
      </div>

      {/* Voile sombre derrière le tiroir mobile */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon" aria-hidden="true"><i className={brandIcon} /></span>
          <span className="sidebar-brand-text">
            <strong>{brandName}</strong>
            {brandSubtitle && <small>{brandSubtitle}</small>}
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          {groupes.map((g, i) => (
            <div className="nav-group" key={g.group ?? `g-${i}`}>
              {g.group && <p className="nav-group-label">{g.group}</p>}
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={
                    'nav-item' +
                    (it.id === activeId ? ' active' : '') +
                    (it.danger ? ' nav-item--danger' : '')
                  }
                  aria-current={it.id === activeId ? 'page' : undefined}
                  onClick={() => choisir(it.id)}
                >
                  <span className="nav-item-icon" aria-hidden="true"><i className={it.icon} /></span>
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {footer && <div className="sidebar-foot">{footer}</div>}
      </aside>
    </>
  )
}
