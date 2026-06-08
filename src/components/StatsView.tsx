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
        <>
          <div className="kpi-row">
            <KpiTile
              icon="🗄️"
              label="Matériel total"
              value={elements?.total ?? 0}
              sub={`${elements?.parType.length ?? 0} type(s) présent(s)`}
            />
            <KpiTile
              icon="🎫"
              label="Tickets total"
              value={tickets?.total ?? 0}
              sub={`${tickets?.parType.length ?? 0} type(s) présent(s)`}
            />
          </div>

          <Breakdown
            title="Répartition du parc"
            group={elements}
            emptyLabel="Aucun élément en base."
          />
          <Breakdown
            title="Répartition des tickets"
            group={tickets}
            emptyLabel="Aucun ticket en base."
          />
        </>
      )}
    </section>
  )
}

function KpiTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: string
  label: string
  value: number
  sub: string
}) {
  return (
    <article className="kpi-tile">
      <span className="kpi-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
        <span className="muted small">{sub}</span>
      </div>
    </article>
  )
}

function Breakdown({
  title,
  group,
  emptyLabel,
}: {
  title: string
  group: StatGroup | null
  emptyLabel: string
}) {
  const total = group?.total ?? 0
  const types = group?.parType ?? []
  const max = types.reduce((m, t) => Math.max(m, t.total), 0) || 1

  return (
    <section className="stat-breakdown">
      <h3 className="stat-breakdown-title">{title}</h3>
      {types.length === 0 ? (
        <p className="muted small">{emptyLabel}</p>
      ) : (
        <ul className="stat-bars stat-bars--grid">
          {types.map((t) => {
            const pct = total > 0 ? Math.round((t.total / total) * 100) : 0
            return (
              <li key={t.key} className="stat-bar-row">
                <div className="stat-bar-label">
                  <span aria-hidden="true">{t.icon}</span>
                  <span className="stat-bar-name">{t.label}</span>
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
    </section>
  )
}
