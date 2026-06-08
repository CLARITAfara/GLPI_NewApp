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
  <section className="section-panel">
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon">
              <i className={section.icon} aria-hidden="true" />
            </span>

            <div>
              <h2>{section.label}</h2>

              <small className="text-muted">
                Données GLPI 
              </small>
            </div>
          </div>

          {status === 'ready' && (
            <span className="badge section-count">
              {total}
            </span>
          )}
        </div>

        {status === 'loading' && (
          <div className="loading-state">
            <div
              className="spinner-border text-primary"
              role="status"
            />

            <p>Chargement des données...</p>
          </div>
        )}

        {status === 'error' && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        {status === 'ready' &&
          rows.length === 0 && (
            <div className="empty-state">
              <h5>Aucune donnée</h5>

              <p className="text-muted">
                Aucun élément disponible.
              </p>
            </div>
          )}

        {status === 'ready' &&
          rows.length > 0 && (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      {section.columns.map((col) => (
                        <th key={col.key}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={String(
                          row.id ?? i
                        )}
                      >
                        {section.columns.map(
                          (col) => (
                            <td key={col.key}>
                              {col.accessor
                                ? col.accessor(
                                    row
                                  )
                                : String(
                                    row[
                                      col.key
                                    ] ?? '—'
                                  )}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > rows.length && (
                <div className="section-footer">
                  <span className="text-muted">
                    {rows.length} éléments
                    affichés sur {total}
                  </span>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  </section>
)
}
