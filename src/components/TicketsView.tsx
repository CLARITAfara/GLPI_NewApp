import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '../format'
import {
  CLASSE_STATUT,
  getCouts,
  getHistoriqueStatut,
  getTicket,
  historiqueDisponible,
  libellePriorite,
  libelleStatut,
  libelleType,
  lireId,
  listerTickets,
  type ChangementStatut,
  type CoutTicket,
  type Ticket,
} from '../services/ticketsApi'

type Status = 'loading' | 'ready' | 'error'

export function TicketsView() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    listerTickets()
      .then(({ items, total }) => {
        if (!active) return
        setTickets(items)
        setTotal(total)
        setSelectedId(items[0]?.id ?? null)
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

  const filtres = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tickets
    return tickets.filter(
      (t) => t.name?.toLowerCase().includes(q) || String(t.id).includes(q),
    )
  }, [tickets, query])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-ticket-detailed" aria-hidden="true" /> Tickets</h2>
        {status === 'ready' && <span className="count-badge">{total}</span>}
      </div>

      {status === 'loading' && <p className="muted">Chargement…</p>}
      {status === 'error' && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      {status === 'ready' && tickets.length === 0 && (
        <p className="muted">Aucun ticket à afficher.</p>
      )}

      {status === 'ready' && tickets.length > 0 && (
        <div className="tickets-layout">
          <div className="tickets-list">
            <input
              className="tickets-search"
              type="search"
              placeholder="Rechercher (titre ou n°)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul>
              {filtres.map((t) => {
                const sid = lireId(t.status)
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={t.id === selectedId ? 'ticket-row active' : 'ticket-row'}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <div className="ticket-row-top">
                        <span className="ticket-ref">#{t.id}</span>
                        <span className={`statut-badge ${sid ? CLASSE_STATUT[sid] ?? '' : ''}`}>
                          {libelleStatut(t.status)}
                        </span>
                      </div>
                      <span className="ticket-row-title">{t.name || '(sans titre)'}</span>
                      <span className="ticket-row-meta">
                        {libelleType(t.type)} · {formatDate(t.date_creation)}
                      </span>
                    </button>
                  </li>
                )
              })}
              {filtres.length === 0 && (
                <li>
                  <p className="muted small">Aucun ticket ne correspond.</p>
                </li>
              )}
            </ul>
          </div>

          <div className="ticket-fiche-wrap">
            {selectedId ? (
              <TicketFiche key={selectedId} id={selectedId} />
            ) : (
              <p className="muted">Sélectionnez un ticket pour voir sa fiche.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Fiche détaillée d'un ticket ──────────────────────────────────────────────

type HistoStatus = 'loading' | 'ready' | 'error'

function TicketFiche({ id }: { id: number }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [couts, setCouts] = useState<CoutTicket[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const [historique, setHistorique] = useState<ChangementStatut[]>([])
  const [histoStatus, setHistoStatus] = useState<HistoStatus>('loading')
  // Stable sur la session (dépend uniquement de la config) : calculé au rendu
  // plutôt que stocké, pour piloter l'affichage sans setState dans l'effet.
  const histoDispo = historiqueDisponible()

  useEffect(() => {
    let active = true
    setStatus('loading')
    Promise.all([getTicket(id), getCouts(id)])
      .then(([t, c]) => {
        if (!active) return
        setTicket(t)
        setCouts(c)
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
  }, [id])

  // Historique de statut chargé à part : son indisponibilité (jeton legacy
  // absent, ou échec API) ne doit pas empêcher l'affichage de la fiche.
  useEffect(() => {
    if (!histoDispo) return
    let active = true
    setHistoStatus('loading')
    getHistoriqueStatut(id)
      .then((h) => {
        if (!active) return
        setHistorique(h)
        setHistoStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setHistoStatus('error')
      })
    return () => {
      active = false
    }
  }, [id, histoDispo])

  if (status === 'loading') return <p className="muted">Chargement de la fiche…</p>
  if (status === 'error')
    return (
      <p className="login-error" role="alert">
        {error}
      </p>
    )
  if (!ticket) return null

  const sid = lireId(ticket.status)
  const description = texteBrut(ticket.content)

  return (
    <article className="ticket-fiche">
      <header className="fiche-head">
        <div>
          <span className="ticket-ref">#{ticket.id}</span>
          <h3>{ticket.name || '(sans titre)'}</h3>
        </div>
        <span className={`statut-badge ${sid ? CLASSE_STATUT[sid] ?? '' : ''}`}>
          {libelleStatut(ticket.status)}
        </span>
      </header>

      <dl className="fiche-grid">
        <Champ label="Type" valeur={libelleType(ticket.type)} />
        <Champ label="Priorité" valeur={libellePriorite(ticket.priority)} />
        <Champ label="Urgence" valeur={libellePriorite(ticket.urgency)} />
        <Champ label="Impact" valeur={libellePriorite(ticket.impact)} />
        <Champ label="Catégorie" valeur={refNom(ticket.category)} />
        <Champ label="Entité" valeur={refNom(ticket.entity)} />
        <Champ label="Ouvert le" valeur={formatDate(ticket.date)} />
        <Champ label="Créé le" valeur={formatDate(ticket.date_creation)} />
        <Champ label="Modifié le" valeur={formatDate(ticket.date_mod)} />
        {ticket.date_solve && <Champ label="Résolu le" valeur={formatDate(ticket.date_solve)} />}
        {ticket.date_close && <Champ label="Clos le" valeur={formatDate(ticket.date_close)} />}
      </dl>

      <div className="fiche-section">
        <h4>Description</h4>
        {description ? (
          <p className="fiche-description">{description}</p>
        ) : (
          <p className="muted small">Aucune description.</p>
        )}
      </div>

      <div className="fiche-section">
        <h4>Historique du statut</h4>
        <HistoriqueStatut
          disponible={histoDispo}
          statut={histoStatus}
          historique={historique}
        />
      </div>

      {couts.length > 0 && (
        <div className="fiche-section">
          <h4>Coûts</h4>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Durée</th>
                  <th>Coût horaire</th>
                  <th>Coût main d'œuvre</th>
                  <th>Coût fixe</th>
                  <th>Coût réel</th>
                </tr>
              </thead>
              <tbody>
                {couts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name || '—'}</td>
                    <td>{formatDuree(c.duration)}</td>
                    <td>{formatMontant(c.cost_time)}</td>
                    <td>{formatMontant(coutMainOeuvre(c))}</td>
                    <td>{formatMontant(c.cost_fixed)}</td>
                    <td>{formatMontant(coutReel(c))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th>{formatDuree(couts.reduce((s, c) => s + (c.duration ?? 0), 0))}</th>
                  <th></th>
                  <th>{formatMontant(couts.reduce((s, c) => s + coutMainOeuvre(c), 0))}</th>
                  <th></th>
                  <th>{formatMontant(couts.reduce((s, c) => s + coutReel(c), 0))}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </article>
  )
}

function Champ({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="fiche-champ">
      <dt>{label}</dt>
      <dd>{valeur}</dd>
    </div>
  )
}

/** Badge de statut à partir d'un id (1..6), « — » si absent. */
function BadgeStatut({ id }: { id?: number }) {
  return (
    <span className={`statut-badge ${id ? CLASSE_STATUT[id] ?? '' : ''}`}>
      {libelleStatut(id)}
    </span>
  )
}

function HistoriqueStatut({
  disponible,
  statut,
  historique,
}: {
  disponible: boolean
  statut: HistoStatus
  historique: ChangementStatut[]
}) {
  if (!disponible)
    return (
      <p className="muted small">
        Historique indisponible : jeton API GLPI non configuré.
      </p>
    )
  if (statut === 'loading') return <p className="muted small">Chargement de l'historique…</p>
  if (statut === 'error')
    return <p className="muted small">Historique du statut indisponible.</p>
  if (historique.length === 0)
    return <p className="muted small">Aucun changement de statut enregistré.</p>

  return (
    <ol className="statut-timeline">
      {historique.map((h) => (
        <li key={h.id} className="statut-timeline-item">
          <span className="statut-timeline-date">{formatDate(h.date)}</span>
          <span className="statut-timeline-change">
            <BadgeStatut id={h.ancien} />
            <span className="statut-timeline-arrow">→</span>
            <BadgeStatut id={h.nouveau} />
          </span>
          <span className="statut-timeline-user muted">par {h.auteur}</span>
        </li>
      ))}
    </ol>
  )
}

// ── Helpers de présentation ──────────────────────────────────────────────────

/** Nom d'un objet lié ({name}) ou tiret. */
function refNom(ref: RefLike): string {
  return ref && typeof ref === 'object' && ref.name ? ref.name : '—'
}
type RefLike = { name?: string } | null | undefined

/** Convertit un contenu HTML (description GLPI) en texte brut, sans XSS. */
function texteBrut(html?: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').trim()
}

/** Durée en secondes → « 1 h 30 min 15 s » / « 45 min 0 s » / « 30 s » / « — ». */
function formatDuree(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h} h ${m} min ${s} s`
  if (m > 0) return `${m} min ${s} s`
  return `${s} s`
}

/**
 * Coût réel d'une ligne : coût horaire ramené à la durée réelle (en heures)
 * + coût fixe + coût matériel. La durée est exprimée en secondes.
 */
function coutReel(c: CoutTicket): number {
  return coutMainOeuvre(c) + (c.cost_fixed ?? 0) + (c.cost_material ?? 0)
}

/** Coût de la main d'œuvre : coût horaire ramené à la durée réelle (en heures). */
function coutMainOeuvre(c: CoutTicket): number {
  return (c.cost_time ?? 0) * ((c.duration ?? 0) / 3600)
}

/** Montant numérique → « 1 234,50 ». */
function formatMontant(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
