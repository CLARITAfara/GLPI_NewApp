import { useState } from 'react'
import { parserImportMvt, appliquerLigne, chargerResolveurRef } from '../../services/importMvtApi'
import type { ResultatLigne } from '../../services/importMvtApi'

export function ImportMvtPanel() {
  const [fichier, setFichier] = useState<File | null>(null)
  const [resultats, setResultats] = useState<ResultatLigne[]>([])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  function onFichier(e: React.ChangeEvent<HTMLInputElement>) {
    setFichier(e.target.files?.[0] ?? null)
    setResultats([])
    setErreur('')
  }

  async function importer() {
    if (!fichier || enCours) return
    setErreur(''); setResultats([]); setEnCours(true)
    try {
      const contenu = await fichier.text()
      const { lignes, erreurs } = parserImportMvt(contenu)
      // Ref_Ticket → id GLPI (par ordre de création), chargé une seule fois.
      const resoudreRef = await chargerResolveurRef()
      const out: ResultatLigne[] = [...erreurs]
      // Séquentiel : évite de surcharger GLPI et garde un ordre de rapport stable.
      for (const l of lignes) out.push(await appliquerLigne(l, resoudreRef))
      out.sort((a, b) => a.numLigne - b.numLigne)
      setResultats(out)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Lecture du fichier impossible.')
    } finally {
      setEnCours(false)
    }
  }

  const nbOk = resultats.filter((r) => r.ok).length
  const nbKo = resultats.length - nbOk

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-upload" aria-hidden="true" /> Import des mouvements (CSV)</h2>
      </div>

      <p className="muted">
        Colonnes attendues : <code>ticket, mvt, valeur, mode</code>. La colonne <code>ticket</code> est le{' '}
        <strong>Ref_Ticket</strong> (la même référence que la Feuille 2 d'import des tickets).
        Mouvements acceptés :{' '}
        <code>reopened</code> (valeur = % à appliquer, <code>mode</code> = 1 dernier / 2 premier / 3 moyenne / 4 somme),{' '}
        <code>cancel</code>/<code>annuler</code> (valeur ignorée),{' '}
        <code>close</code>/<code>terminer</code> (valeur = coût fixe en €).
      </p>

      <div className="import-actions">
        <input type="file" accept=".csv,text/csv" onChange={onFichier} disabled={enCours} />
        <button type="button" className="btn-primary" onClick={importer} disabled={!fichier || enCours}>
          <i className="bi bi-upload" aria-hidden="true" /> Importer
        </button>
      </div>

      {enCours && <p className="muted">Traitement en cours…</p>}
      {erreur && <p className="login-error" role="alert">{erreur}</p>}

      {resultats.length > 0 && (
        <>
          <p className="muted">{nbOk} ligne(s) appliquée(s), {nbKo} en erreur.</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Ligne</th><th>Ref</th><th>Mvt</th><th>Statut</th><th>Détail</th></tr>
              </thead>
              <tbody>
                {resultats.map((r) => (
                  <tr key={r.numLigne}>
                    <td>{r.numLigne}</td>
                    <td>{r.ticket || '—'}</td>
                    <td>{r.mvt}</td>
                    <td>{r.ok ? 'ok' : 'ko'}</td>
                    <td>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
