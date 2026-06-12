import { useEffect, useState } from 'react'
import { chargerCoutsParMateriel } from '../../services/coutsApi'
import type { CoutMateriel } from '../../services/coutsApi'

type Etat = 'loading' | 'ready' | 'error'

function formatMontant(valeur: number): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CoutsPanel() {
  const [lignes, setLignes] = useState<CoutMateriel[]>([])
  const [etat, setEtat] = useState<Etat>('loading')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let actif = true
    chargerCoutsParMateriel()
      .then((donnees) => { if (actif) { setLignes(donnees); setEtat('ready') } })
      .catch((e) => {
        if (actif) { setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'); setEtat('error') }
      })
    return () => { actif = false }
  }, [])

  const totalImport = lignes.reduce((somme, ligne) => somme + ligne.coutImport, 0)
  const totalManuel = lignes.reduce((somme, ligne) => somme + ligne.coutManuel, 0)

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
                <th>Coût import</th>
                <th>Coût manuel</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.libelle}>
                  <td>{ligne.libelle}</td>
                  <td>{formatMontant(ligne.coutImport)}</td>
                  <td>{formatMontant(ligne.coutManuel)}</td>
                  <td>{formatMontant(ligne.coutImport + ligne.coutManuel)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{formatMontant(totalImport)}</td>
                <td>{formatMontant(totalManuel)}</td>
                <td>{formatMontant(totalImport + totalManuel)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
