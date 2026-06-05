import { useEffect, useState } from 'react'
import { getElementStats, getTicketStats } from '../services/statsApi'
import type { StatGroup } from '../services/statsApi'

type Status = 'loading' | 'ready' | 'error'

export function StatsView() {
  const [elements, setElements] = useState<StatGroup | null>(null)
  const [tickets, setTickets] = useState<StatGroup | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setStatus('loading')
    Promise.all([getElementStats(), getTicketStats()])
      .then(([el, tk]) => {
        if (!active) return
        setElements(el)
        setTickets(tk)
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
  }, [])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>📊 Vue d'ensemble</h2>
      </div>

      {status === 'loading' && <p className="muted">Chargement des statistiques…</p>}

      {status === 'error' && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      {status === 'ready' && (
        <div className="stats-grid">
          <StatCard
            icon="🗄️"
            title="Éléments"
            unit="éléments au total"
            group={elements}
            emptyLabel="Aucun élément en base."
          />
          <StatCard
            icon="🎫"
            title="Tickets"
            unit="tickets au total"
            group={tickets}
            emptyLabel="Aucun ticket en base."
          />
        </div>
      )}
    </section>
  )
}

function StatCard({
  icon,
  title,
  unit,
  group,
  emptyLabel,
}: {
  icon: string
  title: string
  unit: string
  group: StatGroup | null
  emptyLabel: string
}) {
  const total = group?.total ?? 0
  const types = group?.parType ?? []
  const max = types.reduce((m, t) => Math.max(m, t.total), 0) || 1

  return (
    <article className="stat-card">
      <header className="stat-card-head">
        <span className="stat-card-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <span className="stat-card-title">{title}</span>
          <div className="stat-total">{total}</div>
          <span className="muted small">{unit}</span>
        </div>
      </header>

      {types.length === 0 ? (
        <p className="muted small">{emptyLabel}</p>
      ) : (
        <ul className="stat-bars">
          {types.map((t) => {
            const pct = total > 0 ? Math.round((t.total / total) * 100) : 0
            return (
              <li key={t.key} className="stat-bar-row">
                <div className="stat-bar-label">
                  <span aria-hidden="true">{t.icon}</span>
                  <span>{t.label}</span>
                  <span className="stat-bar-value">
                    {t.total}
                    <small> · {pct}%</small>
                  </span>
                </div>
                <div className="stat-bar-track">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.round((t.total / max) * 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
