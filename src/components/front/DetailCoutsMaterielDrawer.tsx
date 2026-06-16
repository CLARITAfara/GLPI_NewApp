import { useEffect, useState } from 'react'
import type { CoutMateriel, DetailCoutMateriel } from '../../services/coutsApi'
import { chargerDetailCoutMateriel } from '../../services/coutsApi'
import { formatDate } from '../../format'

interface Props {
  itemtype: string
  libelle: string
  resume: CoutMateriel
  onClose: () => void
}

function fmt(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function DetailCoutsMaterielDrawer({ itemtype, libelle, resume, onClose }: Props) {
  const [detail, setDetail] = useState<DetailCoutMateriel | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    let actif = true
    setChargement(true)
    setDetail(null)
    chargerDetailCoutMateriel(itemtype)
      .then((d) => { if (actif) { setDetail(d); setChargement(false) } })
      .catch(() => { if (actif) setChargement(false) })
    return () => { actif = false }
  }, [itemtype])

  const totalFixe = resume.coutImport + resume.coutManuel + resume.coutReouverture
  const total = totalFixe + resume.coutTime

  const totalPartPrixActif = detail
    ? detail.prix.filter((e) => e.actif).reduce((s, e) => s + e.part, 0)
    : 0
  const totalPartManuelActif = detail
    ? detail.frais.filter((e) => e.actif).reduce((s, e) => s + e.partManuel, 0)
    : 0
  const totalPartFraisActif = detail
    ? detail.frais.reduce((s, e) => s + e.partFrais, 0)
    : 0

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="complementary" aria-label={`Détail coûts — ${libelle}`}>

        <div className="drawer-head">
          <div>
            <p className="drawer-label">Détail des coûts</p>
            <h3 className="drawer-title">{libelle}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">

          {/* ── Résumé ── */}
          <section>
            <h4 className="detail-section-title">Résumé</h4>
            <div className="detail-resume-grid">
              <div className="detail-kpi">
                <span className="detail-kpi__label">Import GLPI</span>
                <span className="detail-kpi__value">{fmt(resume.coutImport)} €</span>
              </div>
              <div className="detail-kpi">
                <span className="detail-kpi__label">Temps GLPI</span>
                <span className="detail-kpi__value">{fmt(resume.coutTime)} €</span>
              </div>
              <div className="detail-kpi">
                <span className="detail-kpi__label">Super Coût</span>
                <span className="detail-kpi__value">{fmt(resume.coutManuel)} €</span>
              </div>
              <div className="detail-kpi">
                <span className="detail-kpi__label">Réouverture</span>
                <span className="detail-kpi__value">{fmt(resume.coutReouverture)} €</span>
              </div>
              <div className="detail-kpi detail-kpi--accent">
                <span className="detail-kpi__label">Total fixe</span>
                <span className="detail-kpi__value">{fmt(totalFixe)} €</span>
              </div>
              <div className="detail-kpi detail-kpi--accent">
                <span className="detail-kpi__label">Total</span>
                <span className="detail-kpi__value">{fmt(total)} €</span>
              </div>
            </div>
          </section>

          {chargement && <p className="muted">Chargement de l'historique…</p>}

          {!chargement && detail && (
            <>
              {/* ── Tableau Prix (TicketCost GLPI) ── */}
              <section>
                <h4 className="detail-section-title">
                  <i className="bi bi-receipt" aria-hidden="true" /> Coûts GLPI (TicketCost)
                </h4>
                {detail.prix.length === 0 ? (
                  <p className="muted">Aucune entrée de coût GLPI pour ce matériel.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Libellé</th>
                          <th>Date</th>
                          <th>Coût fixe</th>
                          <th>Coût temps</th>
                          <th>Part élément</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.prix.map((e, i) => (
                          <tr key={`prix-${e.ticketId}-${i}`} className={e.actif ? '' : 'row-annule'}>
                            <td>#{e.ticketId}</td>
                            <td>{e.nom || '—'}</td>
                            <td>{e.date ? formatDate(e.date) : '—'}</td>
                            <td>{fmt(e.coutFixe)}</td>
                            <td>{fmt(e.coutTemps)}</td>
                            <td>{fmt(e.part)}</td>
                            <td>
                              {e.actif
                                ? <span className="badge-actif">Actif</span>
                                : <span className="badge-annule">Annulé</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5}>Total actif</td>
                          <td>{fmt(totalPartPrixActif)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>

              {/* ── Tableau Frais (manuels + réouverture) ── */}
              <section>
                <h4 className="detail-section-title">
                  <i className="bi bi-percent" aria-hidden="true" /> Frais manuels et réouverture
                </h4>
                {detail.frais.length === 0 ? (
                  <p className="muted">Aucun frais manuel ou de réouverture pour ce matériel.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Super Coût</th>
                          <th>Part manuel</th>
                          <th>% Réouv.</th>
                          <th>Base</th>
                          <th>Frais figés</th>
                          <th>Part frais</th>
                          <th>Calcul</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.frais.map((e, i) => (
                          <tr key={`frais-${e.ticketId}-${i}`} className={e.actif ? '' : 'row-annule'}>
                            <td>#{e.ticketId}</td>
                            <td>{fmt(e.coutManuel)}</td>
                            <td>{fmt(e.partManuel)}</td>
                            <td>{e.pourcentage > 0 ? `${e.pourcentage} %` : '—'}</td>
                            <td>{e.baseReouverture > 0 ? fmt(e.baseReouverture) : '—'}</td>
                            <td>{fmt(e.fraisReouverture)}</td>
                            <td>{fmt(e.partFrais)}</td>
                            <td className="muted">
                              {e.pourcentage > 0
                                ? `${fmt(e.baseReouverture)} × ${e.pourcentage} %`
                                : '—'}
                            </td>
                            <td>
                              {e.actif
                                ? <span className="badge-actif">Actif</span>
                                : <span className="badge-annule">Annulé</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total actif</td>
                          <td />
                          <td>{fmt(totalPartManuelActif)}</td>
                          <td colSpan={3} />
                          <td>{fmt(totalPartFraisActif)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
