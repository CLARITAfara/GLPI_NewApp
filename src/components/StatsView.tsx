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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading')

    Promise.all([
      getElementStats(),
      getTicketStats(),
    ])
      .then(([el, tk]) => {
        if (!active) return

        setElements(el)
        setTickets(tk)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (!active) return

        setError(
          e instanceof Error
            ? e.message
            : 'Erreur de chargement.'
        )

        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <i className="bi bi-bar-chart-line me-2"></i>
          Vue d'ensemble
        </h2>
      </div>

      {status === 'loading' && (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
          />
          <p className="mt-3 mb-0">
            Chargement des statistiques...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {status === 'ready' && (
        <div className="stats-dashboard">
          <StatCard
            icon="bi bi-pc-display"
            title="Éléments"
            unit="éléments au total"
            group={elements}
            emptyLabel="Aucun élément en base."
          />

          <StatCard
            icon="bi bi-ticket-detailed"
            title="Tickets"
            unit="tickets au total"
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

  const max =
    types.reduce(
      (m, t) => Math.max(m, t.total),
      0,
    ) || 1

  return (
    <div className="stats-card">
      <div className="stats-card-header">
        <div className="stats-icon">
          <i className={icon}></i>
        </div>

        <div>
          <h5>{title}</h5>

          <div className="stats-total">
            {total.toLocaleString()}
          </div>

          <small>{unit}</small>
        </div>
      </div>

      {types.length === 0 ? (
        <div className="alert alert-light mt-3 mb-0">
          {emptyLabel}
        </div>
      ) : (
        <div className="stats-list">
          {types.map((t) => {
            const pct =
              total > 0
                ? Math.round(
                    (t.total / total) * 100,
                  )
                : 0

            const width =
              Math.round(
                (t.total / max) * 100,
              )

            return (
              <div
                key={t.key}
                className="stats-item"
              >
                <div className="stats-item-header">
                  <div className="stats-item-name">
                    <i className={`${t.icon} me-2 text-primary`} aria-hidden="true" />

                    <span>{t.label}</span>
                  </div>

                  <div className="stats-item-value">
                    {t.total}

                    <small>{pct}%</small>
                  </div>
                </div>

                <div className="stat-bar-track">
                  <div
                    className="stat-bar-fill"
                    style={{
                      width: `${width}%`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}