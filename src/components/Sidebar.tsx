import { useState, type ReactNode } from 'react'

export interface SidebarNavItem {
  id: string
  label: string
  icon: string
}

interface SidebarProps {
  brandIcon: string
  brandName: string
  brandSubtitle?: string
  items: SidebarNavItem[]
  activeId?: string
  onSelect: (id: string) => void
  /** Contenu de bas de sidebar (profil, déconnexion…). */
  footer?: ReactNode
}

/**
 * Barre latérale de navigation partagée par le back-office et le front-office.
 * Fixe sur desktop ; sur mobile, elle se replie en tiroir (drawer) ouvert par
 * un bouton hamburger dans une barre supérieure.
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
          <span aria-hidden="true">{brandIcon}</span> {brandName}
        </span>
      </div>

      {/* Voile sombre derrière le tiroir mobile */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon" aria-hidden="true">{brandIcon}</span>
          <span className="sidebar-brand-text">
            <strong>{brandName}</strong>
            {brandSubtitle && <small>{brandSubtitle}</small>}
          </span>
        </div>

        <nav className="sidebar-nav">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`nav-item${it.id === activeId ? ' active' : ''}`}
              aria-current={it.id === activeId ? 'page' : undefined}
              onClick={() => choisir(it.id)}
            >
              <span className="nav-item-icon" aria-hidden="true">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </nav>

        {footer && <div className="sidebar-foot">{footer}</div>}
      </aside>
    </>
  )
}
