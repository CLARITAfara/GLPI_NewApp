/**
 * Fil d'Ariane minimal pour situer la section courante dans la hiérarchie
 * (Espace › Groupe › Section). Volontairement « léger » : il complète le titre
 * du panneau (h2) sans le dupliquer — le dernier segment est l'élément actif.
 */
export interface BreadcrumbItem {
  label: string
  /** Si fourni, le segment devient cliquable (navigation). */
  onClick?: () => void
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb" aria-label="Fil d'Ariane">
      <ol>
        {items.map((it, i) => {
          const last = i === items.length - 1
          return (
            <li key={i}>
              {it.onClick && !last ? (
                <button type="button" className="breadcrumb-link" onClick={it.onClick}>
                  {it.label}
                </button>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{it.label}</span>
              )}
              {!last && <span className="breadcrumb-sep" aria-hidden="true">›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
