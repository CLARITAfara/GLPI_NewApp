import type { ElementRow } from '../../services/elementsApi'

export type SortKey = keyof ElementRow
export type SortDir = 'asc' | 'desc'

interface Props {
  rows: ElementRow[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  page: number
  pageSize: number
  onPage: (page: number) => void
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'itemType', label: 'Type' },
  { key: 'name', label: 'Nom' },
  { key: 'status', label: 'Statut' },
  { key: 'location', label: 'Localisation' },
  { key: 'manufacturer', label: 'Fabricant' },
  { key: 'model', label: 'Modèle' },
  { key: 'inventoryNumber', label: 'N° inventaire' },
  { key: 'user', label: 'Utilisateur' },
]

export function ElementsTable({ rows, sortKey, sortDir, onSort, page, pageSize, onPage }: Props) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="sort-icon sort-none">⇅</span>
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="th-sortable"
                  onClick={() => onSort(col.key)}
                  aria-sort={
                    sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={`${row.itemType}-${row.id}-${i}`}>
                <td>
                  <span className="type-badge">{row.itemType}</span>
                </td>
                <td>{row.name}</td>
                <td>{row.status}</td>
                <td>{row.location}</td>
                <td>{row.manufacturer}</td>
                <td>{row.model}</td>
                <td>{row.inventoryNumber}</td>
                <td>{row.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > pageSize && (
        <div className="pagination">
          <button
            type="button"
            className="page-btn"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
          >
            ← Précédent
          </button>
          <span className="page-info">
            Page {page} / {totalPages}
            <span className="muted small"> ({rows.length} résultats)</span>
          </span>
          <button
            type="button"
            className="page-btn"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
          >
            Suivant →
          </button>
        </div>
      )}

      {rows.length > 0 && rows.length <= pageSize && (
        <p className="muted small">{rows.length} élément{rows.length > 1 ? 's' : ''} affiché{rows.length > 1 ? 's' : ''}.</p>
      )}
    </div>
  )
}
