import { useEffect, useState } from 'react'
import {
  chargerEvents,
  modifierReouverture,
  modifierSupercost,
  restaurerEvent,
} from '../../services/coutEventsApi'
import type { CoutEvent } from '../../services/coutEventsApi'
import { listerTicketsFront, changerStatutTicket } from '../../services/ticketsFrontApi'

type Etat = 'loading' | 'ready' | 'error'

const LIBELLES_MODE: Record<number, string> = {
  1: 'Dernier coût',
  2: 'Premier coût',
  3: 'Moyenne',
  4: 'Somme',
}

function formatMontant(valeur: number): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function EditionCoutsPanel() {
  const [events, setEvents] = useState<CoutEvent[]>([])
  const [nomsParTicket, setNomsParTicket] = useState<Map<number, string>>(new Map())
  const [etat, setEtat] = useState<Etat>('loading')
  const [erreur, setErreur] = useState('')
  const [edition, setEdition] = useState<CoutEvent | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  async function recharger() {
    setEtat('loading')
    setErreur('')
    try {
      const [evenements, tickets] = await Promise.all([chargerEvents(), listerTicketsFront()])
      setEvents(evenements)
      setNomsParTicket(new Map(tickets.map((ticket) => [ticket.id, ticket.name])))
      setEtat('ready')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de chargement.')
      setEtat('error')
    }
  }

  useEffect(() => {
    void recharger()
  }, [])

  async function valider(valeurs: { montant?: number; pourcentage?: number; modeCalcul?: number }) {
    if (!edition) return
    setEnregistrement(true)
    try {
      if (edition.type === 'COST') {
        await modifierSupercost(edition.id, valeurs.montant ?? 0)
      } else {
        await modifierReouverture(edition.id, valeurs.pourcentage ?? 0, valeurs.modeCalcul ?? 1)
      }
      setEdition(null)
      await recharger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.")
    } finally {
      setEnregistrement(false)
    }
  }

  // 6 = statut « Clos » (Terminé) : rétablir une annulation reclôt le ticket.
  const STATUT_TERMINE = 6

  const actifs = events.filter((event) => !event.annule)
  const annules = events.filter((event) => event.annule)

  async function retablir(event: CoutEvent) {
    setEnregistrement(true)
    try {
      await restaurerEvent(event.id)
      // L'état « Terminé » revient : on referme le ticket côté GLPI (best-effort).
      try {
        await changerStatutTicket(event.ticketId, STATUT_TERMINE)
      } catch {
        /* best-effort : le recalcul des coûts a déjà eu lieu */
      }
      await recharger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Échec du rétablissement.')
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-pencil-square" aria-hidden="true" /> Édition des coûts</h2>
      </div>

      {etat === 'loading' && <p className="muted">Chargement en cours…</p>}
      {etat === 'error' && <p className="login-error" role="alert">{erreur}</p>}

      {etat === 'ready' && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Pourcentage</th>
                <th>Mode</th>
                <th>Ordre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {actifs.map((event) => (
                <tr key={event.id}>
                  <td>#{event.ticketId}{nomsParTicket.get(event.ticketId) ? ` — ${nomsParTicket.get(event.ticketId)}` : ''}</td>
                  <td>{event.type === 'COST' ? 'Supercost' : 'Réouverture'}</td>
                  <td>{event.type === 'COST' ? formatMontant(event.montant) : '—'}</td>
                  <td>{event.type === 'REOPEN' ? `${event.pourcentage} %` : '—'}</td>
                  <td>{event.type === 'REOPEN' ? (LIBELLES_MODE[event.modeCalcul] ?? '—') : '—'}</td>
                  <td>{event.ordre}</td>
                  <td>
                    <button type="button" className="btn-ghost" onClick={() => setEdition(event)}>
                      <i className="bi bi-pencil" aria-hidden="true" /> Modifier
                    </button>
                  </td>
                </tr>
              ))}
              {actifs.length === 0 && (
                <tr><td colSpan={7} className="muted">Aucune opération active.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {etat === 'ready' && annules.length > 0 && (
        <div className="table-scroll" style={{ marginTop: '1.5rem' }}>
          <h3 className="modal-title"><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Mouvements annulés</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Pourcentage</th>
                <th>Mode</th>
                <th>Ordre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {annules.map((event) => (
                <tr key={event.id}>
                  <td>#{event.ticketId}{nomsParTicket.get(event.ticketId) ? ` — ${nomsParTicket.get(event.ticketId)}` : ''}</td>
                  <td>{event.type === 'COST' ? 'Supercost' : 'Réouverture'}</td>
                  <td>{event.type === 'COST' ? formatMontant(event.montant) : '—'}</td>
                  <td>{event.type === 'REOPEN' ? `${event.pourcentage} %` : '—'}</td>
                  <td>{event.type === 'REOPEN' ? (LIBELLES_MODE[event.modeCalcul] ?? '—') : '—'}</td>
                  <td>{event.ordre}</td>
                  <td>
                    <button type="button" className="btn-ghost" disabled={enregistrement} onClick={() => retablir(event)}>
                      <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Rétablir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edition && (
        <EditionDialog
          event={edition}
          enregistrement={enregistrement}
          onAnnuler={() => setEdition(null)}
          onValider={valider}
        />
      )}
    </section>
  )
}

function EditionDialog({
  event,
  enregistrement,
  onAnnuler,
  onValider,
}: {
  event: CoutEvent
  enregistrement: boolean
  onAnnuler: () => void
  onValider: (valeurs: { montant?: number; pourcentage?: number; modeCalcul?: number }) => void
}) {
  const [montant, setMontant] = useState(String(event.montant))
  const [pourcentage, setPourcentage] = useState(String(event.pourcentage))
  const [modeCalcul, setModeCalcul] = useState(event.modeCalcul)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onAnnuler}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{event.type === 'COST' ? 'Modifier le supercost' : 'Modifier la réouverture'}</h3>

        {event.type === 'COST' ? (
          <>
            <label className="modal-label" htmlFor="edit-montant">Montant</label>
            <input
              id="edit-montant"
              type="number"
              className="modal-input"
              value={montant}
              onChange={(champ) => setMontant(champ.target.value)}
            />
          </>
        ) : (
          <>
            <label className="modal-label" htmlFor="edit-pct">Pourcentage (%)</label>
            <input
              id="edit-pct"
              type="number"
              className="modal-input"
              value={pourcentage}
              onChange={(champ) => setPourcentage(champ.target.value)}
            />
            <label className="modal-label" htmlFor="edit-mode">Mode de calcul</label>
            <select
              id="edit-mode"
              className="modal-input"
              value={modeCalcul}
              onChange={(champ) => setModeCalcul(Number(champ.target.value))}
            >
              <option value={1}>1 — Dernier coût</option>
              <option value={2}>2 — Premier coût</option>
              <option value={3}>3 — Moyenne</option>
              <option value={4}>4 — Somme</option>
            </select>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onAnnuler} disabled={enregistrement}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={enregistrement}
            onClick={() =>
              onValider(
                event.type === 'COST'
                  ? { montant: Number(montant) || 0 }
                  : { pourcentage: Number(pourcentage) || 0, modeCalcul },
              )
            }
          >
            {enregistrement ? 'Recalcul…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
