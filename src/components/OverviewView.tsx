import { useEffect, useState } from 'react'
import { fetchList, fetchTotal, refName } from '../api/glpi'
import type { GlpiRow } from '../api/glpi'
import { formatDate } from '../format'

interface Kpi {
  label: string
  icon: string
  endpoint: string
}

interface KpiGroup {
  group: string
  items: Kpi[]
}

// Indicateurs inspirés du tableau de bord central de GLPI
const GROUPS: KpiGroup[] = [
  {
    group: 'Assistance',
    items: [
      { label: 'Tickets', icon: '🎫', endpoint: '/Assistance/Ticket' },
      { label: 'Changements', icon: '🔁', endpoint: '/Assistance/Change' },
      { label: 'Problèmes', icon: '❗', endpoint: '/Assistance/Problem' },
    ],
  },
  {
    group: 'Parc',
    items: [
      { label: 'Ordinateurs', icon: '💻', endpoint: '/Assets/Computer' },
      { label: 'Moniteurs', icon: '🖥️', endpoint: '/Assets/Monitor' },
      { label: 'Imprimantes', icon: '🖨️', endpoint: '/Assets/Printer' },
      { label: 'Réseau', icon: '🌐', endpoint: '/Assets/NetworkEquipment' },
      { label: 'Logiciels', icon: '🧩', endpoint: '/Assets/Software' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Utilisateurs', icon: '👤', endpoint: '/Administration/User' },
      { label: 'Groupes', icon: '👥', endpoint: '/Administration/Group' },
      { label: 'Entités', icon: '🏢', endpoint: '/Administration/Entity' },
    ],
  },
]

const ALL_ENDPOINTS = GROUPS.flatMap((g) => g.items.map((i) => i.endpoint))

// undefined = en cours, null = erreur, number = valeur
type Counts = Record<string, number | null | undefined>

export function OverviewView() {
  const [counts, setCounts] = useState<Counts>({})
  const [recent, setRecent] = useState<GlpiRow[]>([])

  useEffect(() => {
    let active = true

    Promise.all(
      ALL_ENDPOINTS.map(
        async (ep) => [ep, await fetchTotal(ep).catch(() => null)] as const,
      ),
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries))
    })

    fetchList('/Assistance/Ticket', { limit: 5 })
      .then(({ items }) => {
        if (active) setRecent(items)
      })
      .catch(() => {
        /* ignoré : la section reste vide */
      })

    return () => {
      active = false
    }
  }, [])

  function display(ep: string): string {
    const v = counts[ep]
    if (v === undefined) return '…'
    if (v === null) return '—'
    return String(v)
  }

  return (
    <div className="overview">
      <h1>Vue d'ensemble</h1>

      {GROUPS.map((g) => (
        <div key={g.group} className="kpi-group">
          <h3>{g.group}</h3>
          <div className="kpi-grid">
            {g.items.map((kpi) => (
              <div key={kpi.endpoint} className="kpi-card">
                <span className="kpi-icon" aria-hidden="true">
                  {kpi.icon}
                </span>
                <span className="kpi-value">{display(kpi.endpoint)}</span>
                <span className="kpi-label">{kpi.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="kpi-group">
        <h3>Derniers tickets</h3>
        {recent.length === 0 ? (
          <p className="muted">Aucun ticket récent.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t, i) => (
                  <tr key={String(t.id ?? i)}>
                    <td>{refName(t.id)}</td>
                    <td>{refName(t.name)}</td>
                    <td>{refName(t.status)}</td>
                    <td>{formatDate(t.date_creation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
