import { useEffect, useState } from 'react'
import type { Section } from '../sections'
import { fetchList } from '../services/glpiApi'
import type { GlpiRow } from '../services/glpiApi'

type Status = 'loading' | 'ready' | 'error'

export function SectionView({ section }: { section: Section }) {
  const [rows, setRows] = useState<GlpiRow[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  // Le composant est remonté (via `key`) à chaque changement de section,
  // donc l'état initial 'loading' est déjà correct ici.
  useEffect(() => {
    let active = true
    fetchList(section.endpoint, { limit: 20 })
      .then(({ items, total }) => {
        if (!active) return
        setRows(items)
        setTotal(total)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement.')
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [section.endpoint])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          {section.icon} {section.label}
        </h2>
        {status === 'ready' && <span className="count-badge">{total}</span>}
      </div>

      {status === 'loading' && <p className="muted">Chargement…</p>}
      {status === 'error' && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      {status === 'ready' && rows.length === 0 && (
        <p className="muted">Aucun élément à afficher.</p>
      )}

      {status === 'ready' && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {section.columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  {section.columns.map((col) => (
                    <td key={col.key}>
                      {col.accessor ? col.accessor(row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {total > rows.length && (
            <p className="muted small">
              {rows.length} premiers éléments affichés sur {total}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
