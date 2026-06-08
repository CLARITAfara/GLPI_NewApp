import { useState } from 'react'
import {
  validerImport,
  type ErreurValidation,
  type DonneesImport,
} from '../services/importValidation'
import {
  importer,
  chargerAssetsExistants,
  assetsExistantsDansBdd,
  nomsAssetsBdd,
  type ProgressionImport,
  type RapportImport,
  type AssetExistant,
  type AssetsBdd,
} from '../services/importApi'
import { uploadDisponible } from '../services/legacyApi'
import { ITEM_TYPES } from '../services/importSchemas'

type Phase = 'selection' | 'erreurs' | 'apercu' | 'execution' | 'rapport'

interface Fichiers {
  inventaire: File | null
  tickets: File | null
  couts: File | null
  imagesZip: File | null
}

const VIDE: Fichiers = { inventaire: null, tickets: null, couts: null, imagesZip: null }

const CHAMPS: { cle: keyof Fichiers; label: string; accept: string; aide: string }[] = [
  { cle: 'inventaire', label: 'Feuille 1 — Inventaire', accept: '.csv', aide: 'Ordinateurs & moniteurs' },
  { cle: 'tickets', label: 'Feuille 2 — Tickets', accept: '.csv', aide: 'Tickets et objets liés' },
  { cle: 'couts', label: 'Feuille 3 — Coûts', accept: '.csv', aide: 'Coûts par ticket' },
  { cle: 'imagesZip', label: 'Images (ZIP)', accept: '.zip', aide: 'Optionnel — validé seulement' },
]

export function ImportPanel() {
  const [phase, setPhase] = useState<Phase>('selection')
  const [fichiers, setFichiers] = useState<Fichiers>(VIDE)
  const [erreurs, setErreurs] = useState<ErreurValidation[]>([])
  const [donnees, setDonnees] = useState<DonneesImport | null>(null)
  const [zipBuffer, setZipBuffer] = useState<ArrayBuffer | null>(null)
  const [progression, setProgression] = useState<ProgressionImport | null>(null)
  const [rapport, setRapport] = useState<RapportImport | null>(null)
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [assetsExistants, setAssetsExistants] = useState<AssetExistant[]>([])
  const [verifDoublonsErreur, setVerifDoublonsErreur] = useState<string | null>(null)
  const [assetsBdd, setAssetsBdd] = useState<AssetsBdd | null>(null)

  // Un seul CSV suffit : chaque feuille peut être importée seule. La validation
  // bloquera si une feuille fournie référence une feuille absente.
  const auMoinsUn = !!(fichiers.inventaire || fichiers.tickets || fichiers.couts)

  function choisir(cle: keyof Fichiers, file: File | null) {
    setFichiers((prev) => ({ ...prev, [cle]: file }))
  }

  async function valider() {
    setOccupe(true)
    setErreurGlobale(null)
    try {
      // Charge les matériels déjà présents dans GLPI : sert à valider les liens
      // Tickets→matériel (un asset peut exister en base sans être dans la
      // Feuille 1) et à détecter les doublons. Non bloquant en soi, mais si
      // GLPI est injoignable, tout matériel absent de la Feuille 1 sera bloqué.
      setVerifDoublonsErreur(null)
      let bdd: AssetsBdd | null = null
      try {
        bdd = await chargerAssetsExistants()
      } catch {
        bdd = null
        setVerifDoublonsErreur(
          'Vérification GLPI impossible (API injoignable) : un ticket référençant un matériel absent de la Feuille 1 sera bloqué.',
        )
      }
      setAssetsBdd(bdd)

      const [inventaire, tickets, couts] = await Promise.all([
        fichiers.inventaire?.text() ?? Promise.resolve(null),
        fichiers.tickets?.text() ?? Promise.resolve(null),
        fichiers.couts?.text() ?? Promise.resolve(null),
      ])
      const imagesZip = fichiers.imagesZip ? await fichiers.imagesZip.arrayBuffer() : null
      setZipBuffer(imagesZip)

      const res = validerImport(
        { inventaire, tickets, couts, imagesZip },
        bdd ? nomsAssetsBdd(bdd) : null,
      )
      if (res.ok) {
        setDonnees(res.donnees)
        setAssetsExistants(bdd ? assetsExistantsDansBdd(res.donnees, bdd) : [])
        setPhase('apercu')
      } else {
        setErreurs(res.erreurs)
        setDonnees(res.donnees)
        setPhase('erreurs')
      }
    } catch (e) {
      setErreurGlobale(e instanceof Error ? e.message : 'Erreur de lecture des fichiers.')
    } finally {
      setOccupe(false)
    }
  }

  async function lancerImport() {
    if (!donnees) return
    setPhase('execution')
    setProgression(null)
    const r = await importer(donnees, setProgression, zipBuffer, assetsBdd)
    setRapport(r)
    setPhase('rapport')
  }

  function recommencer() {
    setFichiers(VIDE)
    setErreurs([])
    setDonnees(null)
    setZipBuffer(null)
    setProgression(null)
    setRapport(null)
    setErreurGlobale(null)
    setAssetsExistants([])
    setVerifDoublonsErreur(null)
    setAssetsBdd(null)
    setPhase('selection')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <i className="bi bi-file-earmark-arrow-up me-2" aria-hidden="true" />
          Import CSV
        </h2>
      </div>

      {phase === 'selection' && (
        <PhaseSelection
          fichiers={fichiers}
          occupe={occupe}
          auMoinsUn={auMoinsUn}
          erreurGlobale={erreurGlobale}
          onChoisir={choisir}
          onValider={valider}
        />
      )}

      {phase === 'erreurs' && (
        <PhaseErreurs erreurs={erreurs} onRetour={() => setPhase('selection')} />
      )}

      {phase === 'apercu' && donnees && (
        <PhaseApercu
          donnees={donnees}
          assetsExistants={assetsExistants}
          verifDoublonsErreur={verifDoublonsErreur}
          onRetour={() => setPhase('selection')}
          onConfirmer={lancerImport}
        />
      )}

      {phase === 'execution' && <PhaseExecution progression={progression} />}

      {phase === 'rapport' && rapport && (
        <PhaseRapport rapport={rapport} onRecommencer={recommencer} />
      )}
    </section>
  )
}

// ─── Phase : sélection des fichiers ──────────────────────────────────────────

function PhaseSelection({
  fichiers,
  occupe,
  auMoinsUn,
  erreurGlobale,
  onChoisir,
  onValider,
}: {
  fichiers: Fichiers
  occupe: boolean
  auMoinsUn: boolean
  erreurGlobale: string | null
  onChoisir: (cle: keyof Fichiers, file: File | null) => void
  onValider: () => void
}) {
  return (
  <div>
    <div className="alert alert-info mb-4">
      <h5 className="mb-2">Import de données GLPI</h5>
      <p className="mb-0">
        Sélectionnez les fichiers CSV à importer.
        Les données seront validées avant toute écriture dans GLPI.
      </p>
    </div>

    <div className="row g-4 mb-4">
      {CHAMPS.map((c) => {
        const f = fichiers[c.cle]

        return (
          <div className="col-lg-6" key={c.cle}>
            <div
              className={`import-card ${
                f ? 'selected' : ''
              }`}
            >
              <div className="mb-3">
                <h5>{c.label}</h5>
                <small className="text-muted">
                  {c.aide}
                </small>
              </div>

              <input
                type="file"
                className="form-control"
                accept={c.accept}
                onChange={(e) =>
                  onChoisir(
                    c.cle,
                    e.target.files?.[0] ?? null
                  )
                }
              />

              <div className="mt-3">
                {f ? (
                  <span className="badge bg-success">
                    {f.name}
                  </span>
                ) : (
                  <span className="text-muted">
                    Aucun fichier
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>

    {erreurGlobale && (
      <div className="alert alert-danger">
        {erreurGlobale}
      </div>
    )}

    <div className="d-flex gap-3 align-items-center">
      <button
        className="btn btn-primary"
        onClick={onValider}
        disabled={!auMoinsUn || occupe}
      >
        {occupe ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" />
            Validation...
          </>
        ) : (
          'Valider et importer'
        )}
      </button>

      {!auMoinsUn && (
        <small className="text-muted">
          Sélectionnez au moins un CSV
        </small>
      )}
    </div>
  </div>
)
}

// ─── Phase : erreurs de validation ───────────────────────────────────────────

function PhaseErreurs({ erreurs, onRetour }: { erreurs: ErreurValidation[]; onRetour: () => void }) {
return (
  <div>
    <div className="alert alert-danger d-flex align-items-center mb-4">
      <i className="bi bi-exclamation-triangle-fill me-3 fs-4"></i>

      <div>
        <h5 className="mb-1">Validation échouée</h5>
        <span>
          {erreurs.length} erreur{erreurs.length > 1 ? 's' : ''} détectée
          {erreurs.length > 1 ? 's' : ''}.
          Aucun appel à l'API GLPI n'a été effectué.
        </span>
      </div>
    </div>

    <div className="card shadow-sm border-0">
      <div className="card-header bg-light d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          Détails des erreurs
        </span>

        <span className="badge bg-danger">
          {erreurs.length}
        </span>
      </div>

      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Fichier</th>
                <th>Ligne</th>
                <th>Colonne</th>
                <th>Valeur</th>
                <th>Description</th>
              </tr>
            </thead>

            <tbody>
              {erreurs.map((e, i) => (
                <tr key={i}>
                  <td>
                    <span className="badge bg-secondary">
                      {e.fichier}
                    </span>
                  </td>

                  <td>{e.ligne ?? '—'}</td>

                  <td>
                    <code>{e.colonne}</code>
                  </td>

                  <td>
                    {e.valeur ? (
                      <span className="text-danger">
                        {e.valeur}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div className="d-flex justify-content-end mt-4">
      <button
        className="btn btn-outline-primary"
        onClick={onRetour}
      >
        <i className="bi bi-arrow-left me-2"></i>
        Corriger et recommencer
      </button>
    </div>
  </div>
)
}

// ─── Phase : aperçu avant import ─────────────────────────────────────────────

function PhaseApercu({
  donnees,
  assetsExistants,
  verifDoublonsErreur,
  onRetour,
  onConfirmer,
}: {
  donnees: DonneesImport
  assetsExistants: AssetExistant[]
  verifDoublonsErreur: string | null
  onRetour: () => void
  onConfirmer: () => void
}) {
  const liens = donnees.tickets.reduce((s, t) => s + t.items.length, 0)
  const nomsAssets = new Set(donnees.assets.map((a) => a.name))
  const imagesLiables = donnees.images.filter((p) => {
    const base = (p.split('/').pop() ?? p).replace(/\.[^.]+$/, '')
    return nomsAssets.has(base)
  }).length
  const tokenOk = uploadDisponible()
  const nbExistants = assetsExistants.length
  const nbNouveaux = donnees.assets.length - nbExistants

  return (
  <div>
    <div className="alert alert-success d-flex align-items-center mb-4">
      <i className="bi bi-check-circle-fill me-2"></i>
      <div>
        <strong>Validation réussie</strong>
        <br />
        Les données sont prêtes à être importées dans GLPI.
      </div>
    </div>

    <div className="row g-3 mb-4">
      <div className="col-md-3">
        <div className="card shadow-sm border-0 stat-card">
          <div className="card-body text-center">
            <h2>{donnees.assets.length}</h2>
            <span>Matériels</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-0 stat-card">
          <div className="card-body text-center">
            <h2>{donnees.tickets.length}</h2>
            <span>Tickets</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-0 stat-card">
          <div className="card-body text-center">
            <h2>{donnees.couts.length}</h2>
            <span>Coûts</span>
          </div>
        </div>
      </div>

      {donnees.images.length > 0 && (
        <div className="col-md-3">
          <div className="card shadow-sm border-0 stat-card">
            <div className="card-body text-center">
              <h2>{tokenOk ? imagesLiables : 0}</h2>
              <span>Images</span>
            </div>
          </div>
        </div>
      )}
    </div>

    {nbExistants > 0 && (
      <div className="alert alert-warning">
        <h6 className="mb-2">
          Matériels déjà présents dans GLPI
        </h6>

        <p className="mb-2">
          <strong>{nbExistants}</strong> matériel(s)
          seront réutilisés.
        </p>

        <div className="existing-assets-list">
          {assetsExistants.map((a) => (
            <div
              key={`${a.itemType}-${a.id}`}
              className="existing-asset"
            >
              <span>
                <i className={`${ITEM_TYPES[a.itemType].icone} me-1`} aria-hidden="true" />
              </span>

              <span>{a.name}</span>

              <span className="badge bg-secondary">
                #{a.id}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {verifDoublonsErreur && (
      <div className="alert alert-warning">
        {verifDoublonsErreur}
      </div>
    )}

    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header">
        Résumé de l'import
      </div>

      <div className="card-body">
        <ul className="list-group list-group-flush">
          <li className="list-group-item">
            {nbNouveaux} matériel(s) à créer
          </li>

          <li className="list-group-item">
            {donnees.tickets.length} ticket(s)
          </li>

          <li className="list-group-item">
            {donnees.couts.length} coût(s)
          </li>

          {donnees.images.length > 0 && (
            <li className="list-group-item">
              {imagesLiables} image(s)
              rattachable(s)
            </li>
          )}
        </ul>
      </div>
    </div>

    {liens > 0 && tokenOk && (
      <div className="alert alert-info">
        {liens} lien(s) matériel ↔ ticket
        seront créés.
      </div>
    )}

    {liens > 0 && !tokenOk && (
      <div className="alert alert-warning">
        Les liens matériel ↔ ticket ne
        pourront pas être importés.
      </div>
    )}

    {donnees.images.length > 0 && !tokenOk && (
      <div className="alert alert-warning">
        Upload des images désactivé :
        configurez
        <code>VITE_GLPI_USER_TOKEN</code>.
      </div>
    )}

    {donnees.imagesSansAsset.length > 0 && (
      <div className="alert alert-secondary">
        <strong>Images sans asset :</strong>
        <br />
        {donnees.imagesSansAsset.join(', ')}
      </div>
    )}

    {donnees.assetsSansImage.length > 0 && (
      <div className="alert alert-secondary">
        <strong>Assets sans image :</strong>
        <br />
        {donnees.assetsSansImage.join(', ')}
      </div>
    )}

    <div className="d-flex justify-content-end gap-3 mt-4">
      <button
        className="btn btn-outline-secondary"
        onClick={onRetour}
      >
        Retour
      </button>

      <button
        className="btn btn-primary"
        onClick={onConfirmer}
      >
        Confirmer l'import
      </button>
    </div>
  </div>
)
}

// ─── Phase : exécution ───────────────────────────────────────────────────────

function PhaseExecution({ progression }: { progression: ProgressionImport | null }) {
  const pct =
    progression && progression.total > 0
      ? Math.round((progression.courant / progression.total) * 100)
      : 0
return (
  <div className="card shadow-sm">
    <div className="card-body">
      <h4 className="mb-4">
        Import en cours
      </h4>

      <div className="d-flex justify-content-between mb-2">
        <span>
          {progression?.etape ??
            'Préparation...'}
        </span>

        <strong>
          {progression
            ? `${progression.courant}/${progression.total}`
            : ''}
        </strong>
      </div>

      <div className="progress">
        <div
          className="progress-bar progress-bar-striped progress-bar-animated"
          style={{ width: `${pct}%` }}
        >
          {pct}%
        </div>
      </div>
    </div>
  </div>
)
}

// ─── Phase : rapport final ───────────────────────────────────────────────────

function PhaseRapport({
  rapport,
  onRecommencer,
}: {
  rapport: RapportImport
  onRecommencer: () => void
}) {
return (
  <div>
    {rapport.ok ? (
      <div className="alert alert-success mb-4">
        <h5 className="mb-1">
          Import terminé avec succès
        </h5>
        <p className="mb-0">
          Toutes les données ont été importées dans GLPI.
        </p>
      </div>
    ) : (
      <div className="alert alert-danger mb-4">
        <h5 className="mb-1">
          Import interrompu
        </h5>

        <p className="mb-0">
          {rapport.rollback
            ? 'Rollback effectué : les éléments créés ont été supprimés.'
            : 'Certaines données n’ont pas pu être importées.'}
        </p>

        {rapport.erreur && (
          <div className="mt-2">
            <strong>Détail :</strong>{' '}
            {rapport.erreur}
          </div>
        )}
      </div>
    )}

    <div className="row g-3 mb-4">
      <div className="col-md-3">
        <div className="card shadow-sm border-success">
          <div className="card-body text-center">
            <h2>{rapport.cree.materiel}</h2>
            <span>Matériels créés</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-primary">
          <div className="card-body text-center">
            <h2>{rapport.cree.tickets}</h2>
            <span>Tickets</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-warning">
          <div className="card-body text-center">
            <h2>{rapport.cree.couts}</h2>
            <span>Coûts</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-info">
          <div className="card-body text-center">
            <h2>{rapport.cree.documents}</h2>
            <span>Documents</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-secondary">
          <div className="card-body text-center">
            <h2>{rapport.cree.liens}</h2>
            <span>Liens Ticket ↔ Asset</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-dark">
          <div className="card-body text-center">
            <h2>{rapport.cree.listes}</h2>
            <span>Entrées de liste</span>
          </div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="card shadow-sm border-success">
          <div className="card-body text-center">
            <h2>{rapport.cree.utilisateurs}</h2>
            <span>Utilisateurs</span>
          </div>
        </div>
      </div>

      {rapport.materielReutilise > 0 && (
        <div className="col-md-3">
          <div className="card shadow-sm border-warning">
            <div className="card-body text-center">
              <h2>{rapport.materielReutilise}</h2>
              <span>Matériels réutilisés</span>
            </div>
          </div>
        </div>
      )}
    </div>

    {(rapport.liensIgnores > 0 ||
      rapport.imagesIgnorees > 0) && (
      <div className="alert alert-secondary">
        <strong>Éléments ignorés</strong>

        <div className="mt-2">
          {rapport.liensIgnores} lien(s)
          matériel ↔ ticket
          <br />
          {rapport.imagesIgnorees} image(s)
        </div>
      </div>
    )}

    {rapport.liensEchecs.length > 0 && (
      <div className="card border-warning shadow-sm mb-4">
        <div className="card-header bg-warning-subtle">
          Liens matériel ↔ ticket non importés
        </div>

        <div className="card-body">
          <ul className="list-group list-group-flush">
            {rapport.liensEchecs.map(
              (m, i) => (
                <li
                  key={i}
                  className="list-group-item"
                >
                  {m}
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    )}

    {rapport.liensIgnoresInfo.length >
      0 && (
      <div className="card border-info shadow-sm mb-4">
        <div className="card-header bg-info-subtle">
          Liens ignorés
        </div>

        <div className="card-body">
          <p className="small text-muted">
            Types non associables aux
            tickets dans GLPI.
          </p>

          <ul className="list-group list-group-flush">
            {rapport.liensIgnoresInfo.map(
              (m, i) => (
                <li
                  key={i}
                  className="list-group-item"
                >
                  {m}
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    )}

    {rapport.imagesEchecs.length > 0 && (
      <div className="card border-danger shadow-sm mb-4">
        <div className="card-header bg-danger-subtle">
          Images non importées
        </div>

        <div className="card-body">
          <ul className="list-group list-group-flush">
            {rapport.imagesEchecs.map(
              (m, i) => (
                <li
                  key={i}
                  className="list-group-item"
                >
                  {m}
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    )}

    <div className="d-flex justify-content-end mt-4">
      <button
        className="btn btn-primary"
        onClick={onRecommencer}
      >
        Nouvel import
      </button>
    </div>
  </div>
)
}
