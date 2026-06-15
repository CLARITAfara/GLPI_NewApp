import { useEffect, useState } from 'react'
import { chargerCoutsParMateriel, TYPES_MATERIEL } from '../../services/coutsApi'
import type { CoutMateriel } from '../../services/coutsApi'
import { chargerMvtParMateriel } from '../../services/mvtApi'
import type { MouvementMateriel } from '../../services/mvtApi'
import { formatDate } from '../../format'

type Etat = 'loading' | 'ready' | 'error'

function formatMontant(valeur: number): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CoutsPanel() {
  const [lignes, setLignes] = useState<CoutMateriel[]>([])
  const [etat, setEtat] = useState<Etat>('loading')
  const [erreur, setErreur] = useState('')
  const [mvts, setMvts] = useState<Record<string, MouvementMateriel[]>>({})
  // itemtype + libellé du matériel sélectionné (modale ouverte si non-null).
  const [selection, setSelection] = useState<{ itemtype: string; libelle: string } | null>(null)

  useEffect(() => {
    let actif = true
    chargerCoutsParMateriel()
      .then((donnees) => { if (actif) { setLignes(donnees); setEtat('ready') } })
      .catch((e) => {
        if (actif) { setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'); setEtat('error') }
      })
    chargerMvtParMateriel().then((m) => { if (actif) setMvts(m) }).catch(() => {})
    return () => { actif = false }
  }, [])

  const itemtypePour = (libelle: string) =>
    TYPES_MATERIEL.find((t) => t.libelle === libelle)?.itemtype ?? ''

  const totalImport = lignes.reduce((somme, ligne) => somme + ligne.coutImport, 0)
  const totalTime = lignes.reduce((somme, ligne) => somme + ligne.coutTime, 0)
  const totalManuel = lignes.reduce((somme, ligne) => somme + ligne.coutManuel, 0)
  const totalReouverture = lignes.reduce((somme, ligne) => somme + ligne.coutReouverture, 0)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-cash-coin" aria-hidden="true" /> Coûts par matériel</h2>
      </div>

      {etat === 'loading' && <p className="muted">Chargement en cours…</p>}
      {etat === 'error' && <p className="login-error" role="alert">{erreur}</p>}

      {etat === 'ready' && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matériel</th>
                <th>Coût import(GLPI)</th>
                <th>Coût temps(GLPI)</th>
                <th>Super Coût</th>
                <th>Frais réouverture</th>
                <th>Total fixe</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr
                  key={ligne.libelle}
                  className="row-clickable"
                  title="Voir les mouvements"
                  onClick={() => setSelection({ itemtype: itemtypePour(ligne.libelle), libelle: ligne.libelle })}
                >
                  <td>{ligne.libelle}</td>
                  <td>{formatMontant(ligne.coutImport)}</td>
                  <td>{formatMontant(ligne.coutTime)}</td>
                  <td>{formatMontant(ligne.coutManuel)}</td>
                  <td>{formatMontant(ligne.coutReouverture)}</td>
                  <td>{formatMontant(ligne.coutImport + ligne.coutManuel + ligne.coutReouverture)}</td>
                  <td>{formatMontant(ligne.coutImport + ligne.coutTime + ligne.coutManuel + ligne.coutReouverture)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{formatMontant(totalImport)}</td>
                <td>{formatMontant(totalTime)}</td>
                <td>{formatMontant(totalManuel)}</td>
                <td>{formatMontant(totalReouverture)}</td>
                <td>{formatMontant(totalImport + totalManuel + totalReouverture)}</td>
                <td>{formatMontant(totalImport + totalTime + totalManuel + totalReouverture)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {selection && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelection(null)}>
          <div className="modal-card modal-card--lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">Mouvements — {selection.libelle}</h3>
              <button type="button" className="modal-close" onClick={() => setSelection(null)} aria-label="Fermer">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              {(mvts[selection.itemtype] ?? []).length === 0 ? (
                <p className="muted">Aucun mouvement enregistré pour ce matériel.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr><th>Ticket</th><th>Date</th><th>Mouvement</th><th>Par</th></tr>
                    </thead>
                    <tbody>
                      {(mvts[selection.itemtype] ?? []).map((m, i) => (
                        <tr key={`${m.ticketId}-${i}`}>
                          <td>#{m.ticketId}</td>
                          <td>{formatDate(m.date)}</td>
                          <td>{m.de} → {m.vers}</td>
                          <td>{m.auteur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={() => setSelection(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
