import { useEffect, useMemo, useState } from 'react'
import {
  fetchAllElements,
  applyFilters,
  uniqueValues,
  ALL_ITEM_TYPES,
  EMPTY_FILTERS,
} from '../../services/elementsApi'
import type { ElementRow, ElementFilters } from '../../services/elementsApi'

type LoadStatus = 'loading' | 'ready' | 'error'

// eslint-disable-next-line react-refresh/only-export-components
export function itemKey(item: ElementRow): string {
  return `${item.itemType}:${item.id}`
}

interface Props {
  selected: Set<string>
  onToggle: (item: ElementRow) => void
}

export function ItemSelector({ selected, onToggle }: Props) {
  const [allItems, setAllItems] = useState<ElementRow[]>([])
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [filters, setFilters] = useState<ElementFilters>(EMPTY_FILTERS)

  useEffect(() => {
    let active = true
    fetchAllElements()
      .then(({ rows }) => {
        if (active) { setAllItems(rows); setLoadStatus('ready') }
      })
      .catch(() => { if (active) setLoadStatus('error') })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => applyFilters(allItems, filters), [allItems, filters])

  const opts = useMemo(() => ({
    locations: uniqueValues(allItems, 'location'),
    manufacturers: uniqueValues(allItems, 'manufacturer'),
  }), [allItems])

  function set(field: keyof ElementFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="item-selector">
      {/* Barre de recherche */}
      <div className="item-selector-filters">
        <input
          type="text"
          placeholder="Nom…"
          value={filters.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <select value={filters.itemType} onChange={(e) => set('itemType', e.target.value)}>
          <option value="">Tous les types</option>
          {ALL_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.location} onChange={(e) => set('location', e.target.value)}>
          <option value="">Toutes les localisations</option>
          {opts.locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filters.manufacturer} onChange={(e) => set('manufacturer', e.target.value)}>
          <option value="">Tous les fabricants</option>
          {opts.manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {(filters.name || filters.itemType || filters.location || filters.manufacturer) && (
          <button
            type="button"
            className="btn-ghost item-selector-clear"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Effacer
          </button>
        )}
      </div>

      {/* États */}
      {loadStatus === 'loading' && <p className="muted">Chargement des éléments…</p>}
      {loadStatus === 'error' && (
        <p className="login-error">Erreur lors du chargement des éléments.</p>
      )}

      {/* Liste */}
      {loadStatus === 'ready' && (
        <>
          {filtered.length === 0 ? (
            <p className="muted">Aucun élément trouvé.</p>
          ) : (
            <div className="item-selector-list">
              {filtered.map((item) => {
                const key = itemKey(item)
                const checked = selected.has(key)
                return (
                  <label key={key} className={`item-selector-row${checked ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item)}
                    />
                    <span className="type-badge">{item.itemType}</span>
                    <span className="item-sel-name">{item.name}</span>
                    {item.location !== '—' && (
                      <span className="item-sel-detail">{item.location}</span>
                    )}
                    {item.manufacturer !== '—' && (
                      <span className="item-sel-detail">{item.manufacturer}</span>
                    )}
                    {item.inventoryNumber !== '—' && (
                      <span className="item-sel-detail muted">{item.inventoryNumber}</span>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {selected.size > 0 && (
            // Libellé rendu comme UN SEUL nœud de texte (template literal) et non
            // « {n} élément{s} sélectionné{s} » : ce dernier crée des nœuds de
            // texte adjacents que React insère/retire au changement singulier↔
            // pluriel, ce qui plante (insertBefore NotFoundError → page blanche)
            // quand la traduction auto du navigateur a remplacé ces nœuds.
            <p className="item-selector-count" translate="no">
              {`${selected.size} élément${selected.size > 1 ? 's' : ''} sélectionné${selected.size > 1 ? 's' : ''}`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
