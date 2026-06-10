import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAllElements,
  applyFilters,
  uniqueValues,
  EMPTY_FILTERS,
  FETCH_LIMIT,
} from '../../services/elementsApi'
import type { ElementFilters, ElementRow } from '../../services/elementsApi'
import { ElementsFilters } from './ElementsFilters'
import { ElementsTable } from './ElementsTable'
import type { SortKey, SortDir } from './ElementsTable'

type LoadStatus = 'loading' | 'ready' | 'error'

const PAGE_SIZE = 20

function sortRows(rows: ElementRow[], key: SortKey, dir: SortDir): ElementRow[] {
  return [...rows].sort((a, b) => {
    const va = String(a[key]).toLowerCase()
    const vb = String(b[key]).toLowerCase()
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  })
}

export function ElementsPanel() {
  const [allRows, setAllRows] = useState<ElementRow[]>([])
  const [filters, setFilters] = useState<ElementFilters>(EMPTY_FILTERS)
  const [truncated, setTruncated] = useState(false)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoadStatus('loading')
    setError('')
    try {
      const result = await fetchAllElements()
      setAllRows(result.rows)
      setTruncated(result.truncated)
      setLoadStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement.')
      setLoadStatus('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleReset() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function handleFilterChange(next: ElementFilters) {
    setFilters(next)
    setPage(1)
  }

  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters])
  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir])

  const options = useMemo(() => ({
    statuses: uniqueValues(allRows, 'status'),
    locations: uniqueValues(allRows, 'location'),
    manufacturers: uniqueValues(allRows, 'manufacturer'),
    models: uniqueValues(allRows, 'model'),
    users: uniqueValues(allRows, 'user'),
  }), [allRows])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-box-seam" aria-hidden="true" /> Éléments</h2>
        {loadStatus === 'ready' && (
          <span className="count-badge">
            {filteredRows.length !== allRows.length
              ? `${filteredRows.length} / ${allRows.length}`
              : allRows.length}
          </span>
        )}
      </div>

      <ElementsFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
        onRefresh={load}
        loading={loadStatus === 'loading'}
        options={options}
      />

      {loadStatus === 'loading' && (
        <p className="muted">Chargement en cours…</p>
      )}

      {loadStatus === 'error' && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      {loadStatus === 'ready' && filteredRows.length === 0 && (
        <p className="muted">Aucun élément trouvé pour ces critères.</p>
      )}

      {truncated && (
        <p className="muted small elements-truncated">
          <i className="bi bi-exclamation-triangle" aria-hidden="true" /> Résultats limités à {FETCH_LIMIT} éléments par type. Certains éléments peuvent ne pas apparaître.
        </p>
      )}

      {loadStatus === 'ready' && sortedRows.length > 0 && (
        <ElementsTable
          rows={sortedRows}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}
    </section>
  )
}
