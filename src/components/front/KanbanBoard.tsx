import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  KANBAN_COLUMNS,
  colonnePourStatut,
  listerTicketsFront,
  getTicketFront,
  getSolutionTicket,
  changerStatutTicket,
  resoudreTicket,
} from '../../services/ticketsFrontApi'
import type { KanbanColumnId, InfoRequise, SolutionTicket } from '../../services/ticketsFrontApi'
import { chargerConfigKanban, chargerLangues } from '../../services/kanbanConfigApi'
import { ajouterCoutFixe, annulerDernierCoutFixe, appliquerReouverture } from '../../services/coutsApi'
import type { KanbanColumnConfig, Language } from '../../services/kanbanConfigApi'
import {
  libellePriorite,
  libelleStatut,
  libelleType,
  lireId,
  getHistoriqueStatut,
  historiqueDisponible,
  LIBELLES_STATUT,
} from '../../services/ticketsApi'
import type { Ticket, ChangementStatut } from '../../services/ticketsApi'
import { refName } from '../../services/glpiApi'
import { formatDate } from '../../format'

type LoadStatus = 'loading' | 'ready' | 'error'

const PAGE_SIZE = 10

/** Classe CSS de la pastille de priorité (1..6). */
const CLASSE_PRIORITE: Record<number, string> = {
  1: 'prio-1', 2: 'prio-2', 3: 'prio-3', 4: 'prio-4', 5: 'prio-5', 6: 'prio-6',
}

export function KanbanBoard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')
  const [colConfigs, setColConfigs] = useState<Partial<Record<KanbanColumnId, KanbanColumnConfig>>>({})
  const [languages, setLanguages] = useState<Language[]>([])
  const [selectedLangId, setSelectedLangId] = useState<number | null>(null)

  // Colonne survolée pendant un drag (pour le retour visuel).
  const [pages, setPages] = useState<Record<KanbanColumnId, number>>({ new: 1, progress: 1, done: 1 })

  // Colonne survolée pendant un drag (pour le retour visuel).
  const [dragOver, setDragOver] = useState<KanbanColumnId | null>(null)
  // id du ticket en cours de déplacement (optimiste).
  const draggingId = useRef<number | null>(null)
  // Déplacement en attente d'une saisie (boîte de dialogue ouverte).
  const [pendingMove, setPendingMove] = useState<
    { ticketId: number; colId: KanbanColumnId; info: InfoRequise } | null
  >(null)
  const [pendingReopen, setPendingReopen] = useState<{ ticketId: number; ancien: Ticket['status'] } | null>(null)
  // Ticket dont on affiche la fiche détaillée (modale).
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoadStatus('loading')
    setError('')
    setPages({ new: 1, progress: 1, done: 1 })
    try {
      setTickets(await listerTicketsFront())
      setLoadStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement.')
      setLoadStatus('error')
    }
  }, [])

  // Resynchronisation SILENCIEUSE avec le serveur (sans spinner) : le serveur
  // est la source de vérité. Évite que l'affichage diverge de la base après un
  // déplacement (sinon le rafraîchissement « annulait » visuellement le move).
  const resync = useCallback(async () => {
    try {
      setTickets(await listerTicketsFront())
    } catch {
      /* on conserve l'état optimiste en cas d'échec réseau */
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => { chargerLangues().then(setLanguages) }, [])
  useEffect(() => { chargerConfigKanban(selectedLangId).then(setColConfigs) }, [selectedLangId])

  // Répartit les tickets par colonne — les plus récents en premier.
  const parColonne = useMemo(() => {
    const map: Record<KanbanColumnId, Ticket[]> = { new: [], progress: [], done: [] }
    for (const t of tickets) map[colonnePourStatut(t.status)].push(t)
    for (const col of Object.values(map)) {
      col.sort((a, b) => {
        const da = new Date(a.date_mod ?? '').getTime()
        const db = new Date(b.date_mod ?? '').getTime()
        return db - da
      })
    }
    return map
  }, [tickets])

  // Applique un changement de statut en optimiste, puis réconcilie avec le statut
  // RÉEL renvoyé par le serveur (action()). Annule proprement si l'API échoue.
  //
  // IMPORTANT : `ancien` est passé EN PARAMÈTRE (lu dans l'état AVANT l'appel) et
  // NON lu dans l'updater de setTickets. En effet, comme `deposer`/`confirmerInfo`
  // déclenchent une autre mise à jour juste avant (setDragOver/setPendingMove),
  // React désactive l'optimisation « eager state » : l'updater n'est plus exécuté
  // de façon synchrone, donc toute variable qu'on y affecterait (ex. un drapeau
  // `existe`) resterait fausse au moment de la lire → on sortait AVANT d'appeler
  // l'API, et le déplacement n'était jamais persisté (revenait au refresh).
  async function appliquer(
    id: number,
    statutCible: number,
    ancien: Ticket['status'],
    action: () => Promise<number>,
  ) {
    // Mise à jour optimiste (updater PUR, sans effet de bord).
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: statutCible } : t)))

    try {
      const statutReel = await action()
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: statutReel } : t)))
      // On relit depuis le serveur pour garantir que l'affichage == la base.
      await resync()
    } catch (e) {
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: ancien } : t)))
      setError(e instanceof Error ? e.message : 'Le déplacement a échoué.')
    }
  }

  // ── Déplacement (drag & drop) — vers n'importe quelle colonne ────────────────
  // `id` est passé par le drop (lu dans dataTransfer), avec repli sur le ref.
  function deposer(colId: KanbanColumnId, idDepuisEvent: number | null) {
    const id = idDepuisEvent ?? draggingId.current
    draggingId.current = null
    setDragOver(null)
    if (id === null) return

    const ticket = tickets.find((t) => t.id === id)
    const colDef = KANBAN_COLUMNS.find((c) => c.id === colId)!
    if (!ticket || colonnePourStatut(ticket.status) === colId) return

    if (colId === 'progress' && colonnePourStatut(ticket.status) === 'done') {
      setPendingReopen({ ticketId: id, ancien: ticket.status })
      return
    }

    // Le changement nécessite une saisie → on ouvre la boîte de dialogue.
    if (colDef.infoRequise) {
      setPendingMove({ ticketId: id, colId, info: colDef.infoRequise })
      return
    }
    // Sinon, application directe (on capture le statut courant pour pouvoir annuler).
    appliquer(id, colDef.statutCible, ticket.status, () => changerStatutTicket(id, colDef.statutCible))
  }

  // Confirmation de la boîte de dialogue (ex. résolution avec solution saisie).
  async function confirmerInfo(texte: string, coutFixe: number) {
    if (!pendingMove) return
    const { ticketId, colId } = pendingMove
    const colDef = KANBAN_COLUMNS.find((c) => c.id === colId)!
    const ancien = tickets.find((t) => t.id === ticketId)?.status ?? colDef.statutCible
    setPendingMove(null)
    await appliquer(ticketId, colDef.statutCible, ancien, () => resoudreTicket(ticketId, texte))
    if (coutFixe > 0) {
      try {
        await ajouterCoutFixe(ticketId, coutFixe)
      } catch {
        void 0
      }
    }
  }

  async function annulerCloture() {
    if (!pendingReopen) return
    const { ticketId, ancien } = pendingReopen
    setPendingReopen(null)
    await appliquer(ticketId, 2, ancien, () => changerStatutTicket(ticketId, 2))
    try {
      await annulerDernierCoutFixe(ticketId)
    } catch {
      void 0
    }
  }

  async function confirmerReouverture(pourcentage: number) {
    if (!pendingReopen) return
    const { ticketId, ancien } = pendingReopen
    setPendingReopen(null)
    await appliquer(ticketId, 2, ancien, () => changerStatutTicket(ticketId, 2))
    try {
      await appliquerReouverture(ticketId, pourcentage)
    } catch {
      void 0
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-kanban" aria-hidden="true" /> Tickets — Kanban</h2>
        <div className="kanban-head-actions">
          {loadStatus === 'ready' && <span className="count-badge">{tickets.length}</span>}
          {languages.length > 0 && (
            <select
              className="kanban-lang-select"
              value={selectedLangId ?? ''}
              onChange={(e) => setSelectedLangId(e.target.value === '' ? null : Number(e.target.value))}
              aria-label="Langue des colonnes"
            >
              <option value="">Défaut</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn-ghost" onClick={load} disabled={loadStatus === 'loading'}>
            ↻ Rafraîchir
          </button>
        </div>
      </div>

      {loadStatus === 'error' && <p className="login-error" role="alert">{error}</p>}
      {loadStatus === 'loading' && <p className="muted">Chargement en cours…</p>}

      {loadStatus !== 'loading' && (
        <div className="kanban-board">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              titre={col.titre}
              label={colConfigs[col.id]?.label ?? null}
              backgroundColor={colConfigs[col.id]?.backgroundColor ?? null}
              tickets={parColonne[col.id]}
              isOver={dragOver === col.id}
              page={pages[col.id]}
              onPageChange={(p) => setPages((prev) => ({ ...prev, [col.id]: p }))}
              onDragEnterCol={() => setDragOver(col.id)}
              onDragLeaveCol={() => setDragOver((c) => (c === col.id ? null : c))}
              onDrop={(id) => deposer(col.id, id)}
              onDragStartCard={(id) => { draggingId.current = id }}
              onOpenCard={(id) => setDetailId(id)}
            />
          ))}
        </div>
      )}

      {pendingMove && (
        <InfoDialog
          info={pendingMove.info}
          onCancel={() => setPendingMove(null)}
          onConfirm={confirmerInfo}
        />
      )}

      {pendingReopen && (
        <ReopenDialog
          onCancel={() => setPendingReopen(null)}
          onAnnuler={annulerCloture}
          onReouvrir={confirmerReouverture}
        />
      )}

      {detailId !== null && (
        <TicketDetailDialog id={detailId} onClose={() => setDetailId(null)} />
      )}
    </section>
  )
}

// ── Colonne ───────────────────────────────────────────────────────────────────
interface ColumnProps {
  id: KanbanColumnId
  titre: string
  label: string | null
  backgroundColor: string | null
  tickets: Ticket[]
  isOver: boolean
  page: number
  onPageChange: (page: number) => void
  onDragEnterCol: () => void
  onDragLeaveCol: () => void
  onDrop: (id: number | null) => void
  onDragStartCard: (id: number) => void
  onOpenCard: (id: number) => void
}

function KanbanColumn(props: ColumnProps) {
  const { id, titre, label, backgroundColor, tickets, isOver, page, onPageChange, onDragEnterCol, onDragLeaveCol, onDrop, onDragStartCard, onOpenCard } = props

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = tickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const style = backgroundColor
    ? ({ '--col-bg': backgroundColor } as React.CSSProperties)
    : undefined

  return (
    <div
      className={`kanban-col kanban-col--${id}${isOver ? ' kanban-col--over' : ''}`}
      style={style}
      onDragOver={(e) => { e.preventDefault(); onDragEnterCol() }}
      onDragLeave={onDragLeaveCol}
      onDrop={(e) => {
        e.preventDefault()
        const brut = e.dataTransfer.getData('text/plain')
        const dropped = brut ? Number(brut) : null
        onDrop(Number.isFinite(dropped) ? dropped : null)
      }}
    >
      <div className="kanban-col-head">
        <span className="kanban-col-title">
          {label ?? titre}
          {label && <span className="kanban-col-subtitle">{titre}</span>}
        </span>
        <span className="kanban-col-count">{tickets.length}</span>
      </div>

      <div className="kanban-col-body">
        {visible.map((t) => (
          <KanbanCard
            key={t.id}
            ticket={t}
            onDragStart={() => onDragStartCard(t.id)}
            onOpen={() => onOpenCard(t.id)}
          />
        ))}
        {id === 'new' && (
          <Link to="/tickets/create" className="kanban-add-btn">
            <span className="kanban-add-icon"><i className="bi bi-plus-lg" aria-hidden="true" /></span> Ajouter 1 ticket
          </Link>
        )}
      </div>

      {totalPages > 1 && (
        <div className="kanban-col-footer">
          <button
            type="button"
            className="kanban-page-btn"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Page précédente"
          >‹</button>
          <span className="kanban-page-info">{currentPage} / {totalPages}</span>
          <button
            type="button"
            className="kanban-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Page suivante"
          >›</button>
        </div>
      )}
    </div>
  )
}

// ── Carte ticket ────────────────────────────────────────────────────────────
function KanbanCard(
  { ticket, onDragStart, onOpen }:
  { ticket: Ticket; onDragStart: () => void; onOpen: () => void },
) {
  const prio = ticket.priority ?? 0
  // Distinction clic (ouvrir la fiche) / glisser (déplacer). Le drapeau est
  // remis à zéro à CHAQUE début d'interaction (pointerdown), puis passé à true
  // seulement si un vrai drag démarre — fiable interaction après interaction.
  const dragged = useRef(false)

  return (
    <article
      className="kanban-card"
      draggable
      role="button"
      tabIndex={0}
      onPointerDown={() => { dragged.current = false }}
      onDragStart={(e) => {
        dragged.current = true
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(ticket.id))
        onDragStart()
      }}
      onClick={() => { if (!dragged.current) onOpen() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <div className="kanban-card-title">{ticket.name || `Ticket ${ticket.id}`}</div>
      <div className="kanban-card-meta">
        <span className="kanban-card-id">#{ticket.id}</span>
        {prio > 0 && (
          <span className={`prio-badge ${CLASSE_PRIORITE[prio] ?? ''}`}>
            {libellePriorite(prio)}
          </span>
        )}
      </div>
    </article>
  )
}

// ── Boîte de dialogue « informations complémentaires » ────────────────────────
// Affichée quand un changement de statut exige une saisie (ex. solution).
interface InfoDialogProps {
  info: InfoRequise
  onCancel: () => void
  onConfirm: (texte: string, coutFixe: number) => void | Promise<void>
}

function InfoDialog({ info, onCancel, onConfirm }: InfoDialogProps) {
  const [texte, setTexte] = useState('')
  const [coutFixe, setCoutFixe] = useState('')
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function valider() {
    if (!texte.trim()) {
      setErr('Ce champ est obligatoire.')
      return
    }
    onConfirm(texte.trim(), Number(coutFixe) || 0)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{info.titre}</h3>
        {info.hint && <p className="modal-hint">{info.hint}</p>}
        <label className="modal-label" htmlFor="kanban-info-field">
          {info.label} <span className="req">*</span>
        </label>
        <textarea
          id="kanban-info-field"
          ref={inputRef}
          className="modal-input"
          value={texte}
          onChange={(e) => { setTexte(e.target.value); if (err) setErr('') }}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          placeholder={info.placeholder}
          rows={4}
        />
        {err && <span className="field-error">{err}</span>}
        {info.coutFixe && (
          <>
            <label className="modal-label" htmlFor="kanban-cout-field">Coût fixe (optionnel)</label>
            <input
              id="kanban-cout-field"
              type="number"
              min="0"
              step="0.01"
              className="modal-input"
              value={coutFixe}
              onChange={(e) => setCoutFixe(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
              placeholder="0"
            />
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="button" className="btn-primary" onClick={valider}>Confirmer</button>
        </div>
      </div>
    </div>
  )
}

function ReopenDialog({ onCancel, onAnnuler, onReouvrir }: {
  onCancel: () => void
  onAnnuler: () => void | Promise<void>
  onReouvrir: (pourcentage: number) => void | Promise<void>
}) {
  const [pourcentage, setPourcentage] = useState('')

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Rouvrir le ticket</h3>
        <p className="modal-hint">« Annulation » rouvre et supprime le coût saisi (clôture erronée). « Réouverture » rouvre et ajoute un pourcentage du dernier coût.</p>
        <label className="modal-label" htmlFor="kanban-reopen-pct">Pourcentage du dernier coût (%)</label>
        <input
          id="kanban-reopen-pct"
          type="number"
          min="0"
          step="0.1"
          className="modal-input"
          value={pourcentage}
          onChange={(e) => setPourcentage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          placeholder="0"
        />
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onAnnuler}>Annulation</button>
          <button type="button" className="btn-primary" onClick={() => onReouvrir(Number(pourcentage) || 0)}>Réouverture</button>
        </div>
      </div>
    </div>
  )
}

// ── Fiche détaillée d'un ticket (modale, ouverte au clic sur une carte) ───────
/** Convertit le HTML enrichi de GLPI en texte lisible (sauts de ligne conservés). */
function htmlEnTexte(html?: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/**
 * Libellé d'un statut aligné sur le flux du Kanban (3 colonnes) : tout statut
 * GLPI est ramené au titre de sa colonne (Nouveau / In progress / Terminé).
 * Ainsi l'historique « respecte le flux » même si d'anciens statuts existent.
 */
function libelleFluxStatut(id?: number): string {
  if (!id) return ''
  const col = KANBAN_COLUMNS.find((c) => c.statuts.includes(id))
  return col?.titre ?? LIBELLES_STATUT[id] ?? `Statut ${id}`
}

/** Transition de l'historique, ramenée aux colonnes du Kanban. */
interface TransitionFlux {
  id: number
  date: string
  auteur: string
  de: string // '' = création
  vers: string
}

/**
 * Construit l'historique « flux » : on convertit chaque changement en colonnes
 * Kanban et on NE GARDE que les transitions qui changent réellement de colonne
 * (un 2→3, tous deux « In progress », est du bruit qu'on masque).
 */
function historiqueFlux(changements: ChangementStatut[]): TransitionFlux[] {
  const out: TransitionFlux[] = []
  for (const c of changements) {
    const de = libelleFluxStatut(c.ancien)
    const vers = libelleFluxStatut(c.nouveau)
    if (!vers || de === vers) continue
    out.push({ id: c.id, date: c.date, auteur: c.auteur, de, vers })
  }
  return out
}

function TicketDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [solution, setSolution] = useState<SolutionTicket | null>(null)
  const [historique, setHistorique] = useState<ChangementStatut[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let actif = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading')

    getTicketFront(id)
      .then(async (t) => {
        if (!actif) return
        setTicket(t)
        setStatus('ready')

        // Historique des statuts (best-effort, ne bloque pas l'affichage).
        if (historiqueDisponible()) {
          getHistoriqueStatut(id).then((h) => { if (actif) setHistorique(h) }).catch(() => {})
        }
        // Solution : seulement si le ticket est résolu (5) ou clos (6).
        const statutId = lireId(t.status)
        if (statutId === 5 || statutId === 6) {
          getSolutionTicket(id).then((s) => { if (actif) setSolution(s) }).catch(() => {})
        }
      })
      .catch((e) => {
        if (actif) {
          setError(e instanceof Error ? e.message : 'Erreur lors du chargement.')
          setStatus('error')
        }
      })
    return () => { actif = false }
  }, [id])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card modal-card--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">
            {status === 'ready' && ticket ? (ticket.name || `Ticket ${ticket.id}`) : `Ticket #${id}`}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><i className="bi bi-x-lg" aria-hidden="true" /></button>
        </div>

        <div className="modal-body">
        {status === 'loading' && <p className="muted">Chargement…</p>}
        {status === 'error' && <p className="login-error" role="alert">{error}</p>}

        {status === 'ready' && ticket && (
          <>
            <dl className="detail-grid">
              <div><dt>N°</dt><dd>#{ticket.id}</dd></div>
              <div><dt>Statut</dt><dd>{libelleStatut(ticket.status)}</dd></div>
              <div><dt>Type</dt><dd>{libelleType(ticket.type)}</dd></div>
              <div><dt>Priorité</dt><dd>{libellePriorite(ticket.priority)}</dd></div>
              <div><dt>Urgence</dt><dd>{libellePriorite(ticket.urgency)}</dd></div>
              <div><dt>Impact</dt><dd>{libellePriorite(ticket.impact)}</dd></div>
              <div><dt>Catégorie</dt><dd>{refName(ticket.category)}</dd></div>
              <div><dt>Entité</dt><dd>{refName(ticket.entity)}</dd></div>
              <div><dt>Créé le</dt><dd>{formatDate(ticket.date_creation ?? ticket.date)}</dd></div>
              <div><dt>Modifié le</dt><dd>{formatDate(ticket.date_mod)}</dd></div>
            </dl>

            <div className="detail-section">
              <h4 className="detail-section-title">Description</h4>
              <p className="detail-content">{htmlEnTexte(ticket.content) || '—'}</p>
            </div>

            {/* Solution (uniquement si résolu/clos et solution présente) */}
            {solution && (
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" /> Solution
                  {solution.date && (
                    <span className="detail-section-date">{formatDate(solution.date)}</span>
                  )}
                </h4>
                <p className="detail-content">{htmlEnTexte(solution.content) || '—'}</p>
              </div>
            )}

            {/* Historique des changements de statut, ramené au flux du Kanban */}
            <div className="detail-section">
              <h4 className="detail-section-title">Historique des statuts</h4>
              {(() => {
                const flux = historiqueFlux(historique)
                if (flux.length === 0) {
                  return (
                    <p className="muted small">
                      {historiqueDisponible()
                        ? 'Aucun changement de statut enregistré.'
                        : 'Historique indisponible (jeton API non configuré).'}
                    </p>
                  )
                }
                return (
                  <ul className="statut-timeline">
                    {flux.map((h) => (
                      <li key={h.id} className="statut-timeline-item">
                        <span className="statut-timeline-date">{formatDate(h.date)}</span>
                        <span className="statut-timeline-change">
                          <span className="statut-chip">{h.de || 'Création'}</span>
                          <span className="statut-arrow">→</span>
                          <span className="statut-chip statut-chip--new">{h.vers}</span>
                        </span>
                        {h.auteur && h.auteur !== '—' && (
                          <span className="statut-timeline-author">par {h.auteur}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>
          </>
        )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
