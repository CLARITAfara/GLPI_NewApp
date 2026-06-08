import { useEffect, useState } from 'react'
import {
  MODULES_RESET,
  compterEndpoints,
  reinitialiser,
  type CompteursEndpoints,
  type ModuleReset,
  type ResultatModule,
  type ProgressionModule,
} from '../services/resetApi'

type Phase = 'selection' | 'confirmation' | 'execution' | 'rapport'

export function ResetPanel() {
  const [phase, setPhase] = useState<Phase>('selection')
  const [selectionnees, setSelectionnees] = useState<Set<string>>(new Set())
  const [motConfirmation, setMotConfirmation] = useState('')
  const [progressions, setProgressions] = useState<Record<string, ProgressionModule>>({})
  const [chargementIds, setChargementIds] = useState<Set<string>>(new Set())
  const [resultats, setResultats] = useState<ResultatModule[]>([])
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const [compteurs, setCompteurs] = useState<CompteursEndpoints | null>(null)

  const tousSelectionnees = selectionnees.size === MODULES_RESET.length
  const modulesSelectionnees = MODULES_RESET.filter((m) => selectionnees.has(m.id))

  // Charge le nombre d'enregistrements en base (via l'API GLPI directe).
  useEffect(() => {
    let actif = true
    compterEndpoints(MODULES_RESET).then((c) => {
      if (actif) setCompteurs(c)
    })
    return () => {
      actif = false
    }
  }, [])

  function toggleModule(id: string) {
    setSelectionnees((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTout() {
    if (tousSelectionnees) {
      setSelectionnees(new Set())
    } else {
      setSelectionnees(new Set(MODULES_RESET.map((m) => m.id)))
    }
  }

  function ouvrirConfirmation() {
    setMotConfirmation('')
    setPhase('confirmation')
  }

  function fermerConfirmation() {
    setPhase('selection')
  }

  async function lancerReset() {
    if (motConfirmation !== 'RESET') return

    const modules = modulesSelectionnees
    const progressionsInit: Record<string, ProgressionModule> = {}
    const chargementInit = new Set<string>()
    for (const m of modules) {
      progressionsInit[m.id] = { total: 0, traites: 0 }
      chargementInit.add(m.id)
    }
    setProgressions(progressionsInit)
    setChargementIds(chargementInit)
    setErreurGlobale(null)
    setPhase('execution')

    try {
      const res = await reinitialiser(modules, (moduleId, p) => {
        setChargementIds((prev) => {
          const next = new Set(prev)
          next.delete(moduleId)
          return next
        })
        setProgressions((prev) => ({ ...prev, [moduleId]: p }))
      })
      setResultats(res)
    } catch (err) {
      setErreurGlobale(err instanceof Error ? err.message : 'Erreur inattendue.')
    } finally {
      setPhase('rapport')
    }
  }

  function recommencer() {
    setSelectionnees(new Set())
    setProgressions({})
    setChargementIds(new Set())
    setResultats([])
    setErreurGlobale(null)
    setPhase('selection')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <i className="bi bi-trash me-2" aria-hidden="true" />
          Réinitialisation
        </h2>
      </div>

      {phase === 'selection' && (
        <PhaseSelection
          selectionnees={selectionnees}
          tousSelectionnees={tousSelectionnees}
          compteurs={compteurs}
          onToggle={toggleModule}
          onToggleTout={toggleTout}
          onLancer={ouvrirConfirmation}
        />
      )}

      {phase === 'confirmation' && (
        <PhaseConfirmation
          modules={modulesSelectionnees}
          motConfirmation={motConfirmation}
          onChangeMot={setMotConfirmation}
          onAnnuler={fermerConfirmation}
          onConfirmer={lancerReset}
        />
      )}

      {phase === 'execution' && (
        <PhaseExecution
          modules={modulesSelectionnees}
          progressions={progressions}
          chargementIds={chargementIds}
        />
      )}

      {phase === 'rapport' && (
        <PhaseRapport
          resultats={resultats}
          erreurGlobale={erreurGlobale}
          onRecommencer={recommencer}
        />
      )}
    </section>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────

function PhaseSelection({
  selectionnees,
  tousSelectionnees,
  compteurs,
  onToggle,
  onToggleTout,
  onLancer,
}: {
  selectionnees: Set<string>
  tousSelectionnees: boolean
  compteurs: CompteursEndpoints | null
  onToggle: (id: string) => void
  onToggleTout: () => void
  onLancer: () => void
}) {
 return (
  <>
    <div className="alert alert-warning">
      <strong>Attention :</strong> cette opération supprimera définitivement
      les données sélectionnées dans GLPI.
    </div>

    <div className="d-flex justify-content-between align-items-center mb-4">
      <h4 className="mb-0">
        Modules à réinitialiser
      </h4>

      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={tousSelectionnees}
          onChange={onToggleTout}
          id="select-all"
        />

        <label
          className="form-check-label"
          htmlFor="select-all"
        >
          Tout sélectionner
        </label>
      </div>
    </div>

    <div className="row g-3">
      {MODULES_RESET.map((m) => {
        const n = compteurs?.[m.endpoints[0].endpoint]

        return (
          <div
            className="col-md-6 col-xl-4"
            key={m.id}
          >
            <div
              className={`reset-card ${
                selectionnees.has(m.id)
                  ? 'selected'
                  : ''
              }`}
            >
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={selectionnees.has(
                    m.id
                  )}
                  onChange={() =>
                    onToggle(m.id)
                  }
                />
              </div>

              <div className="reset-card-icon">
                <i className={`${m.icone} fs-4`} aria-hidden="true" />
              </div>

              <h5>{m.label}</h5>

              <p>{m.description}</p>

              <span className="badge bg-primary">
                {n ?? '...'} éléments
              </span>
            </div>
          </div>
        )
      })}
    </div>

    <div className="mt-4">
      <button
        className="btn btn-danger"
        disabled={
          selectionnees.size === 0
        }
        onClick={onLancer}
      >
        Réinitialiser (
        {selectionnees.size})
      </button>
    </div>
  </>
)
}

function PhaseConfirmation({
  modules,
  motConfirmation,
  onChangeMot,
  onAnnuler,
  onConfirmer,
}: {
  modules: ModuleReset[]
  motConfirmation: string
  onChangeMot: (v: string) => void
  onAnnuler: () => void
  onConfirmer: () => void
}) {
  const totalEndpoints = modules.reduce(
    (s, m) => s + m.endpoints.length,
    0
  )

  return (
    <div className="card border-danger">
      <div className="card-body">
        <h4 className="text-danger mb-3">
          Confirmation requise
        </h4>

        <div className="alert alert-danger">
          <strong>Attention :</strong> cette action supprimera
          définitivement les données GLPI sélectionnées.
        </div>

        <div className="mb-4">
          <p className="mb-1">
            Modules sélectionnés :
          </p>

          <h5>
            {modules.length} module
            {modules.length > 1 ? 's' : ''}
          </h5>

          <p className="text-muted mb-0">
            {totalEndpoints} endpoint
            {totalEndpoints > 1 ? 's' : ''} concerné
            {totalEndpoints > 1 ? 's' : ''}
          </p>
        </div>

        <ul className="list-group mb-4">
          {modules.map((m) => (
            <li
              key={m.id}
              className="list-group-item"
            >
              <div className="d-flex justify-content-between">
                <span>
                  <i className={`${m.icone} me-1`} aria-hidden="true" /> {m.label}
                </span>

                <span className="badge bg-secondary">
                  {m.endpoints.length}
                </span>
              </div>

              <small className="text-muted">
                {m.endpoints
                  .map((e) => e.label)
                  .join(', ')}
              </small>
            </li>
          ))}
        </ul>

        <div className="mb-3">
          <label
            htmlFor="reset-input"
            className="form-label"
          >
            Tapez <strong>RESET</strong> pour confirmer
          </label>

          <input
            id="reset-input"
            className="form-control"
            value={motConfirmation}
            onChange={(e) =>
              onChangeMot(e.target.value)
            }
            placeholder="RESET"
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={onAnnuler}
          >
            Annuler
          </button>

          <button
            className="btn btn-danger"
            disabled={motConfirmation !== 'RESET'}
            onClick={onConfirmer}
          >
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  )
}

function PhaseExecution({
  modules,
  progressions,
  chargementIds,
}: {
  modules: ModuleReset[]
  progressions: Record<string, ProgressionModule>
  chargementIds: Set<string>
}) {
 return (
  <div>
    <div className="alert alert-info d-flex align-items-center mb-4">
      <div
        className="spinner-border spinner-border-sm me-3"
        role="status"
      />
      <div>
        Réinitialisation en cours. Veuillez patienter pendant la suppression
        des données GLPI.
      </div>
    </div>

    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h4 className="mb-4">
          Progression de la réinitialisation
        </h4>

        {modules.map((m) => {
          const prog = progressions[m.id] ?? {
            total: 0,
            traites: 0,
          }

          const enChargement =
            chargementIds.has(m.id)

          const pct =
            prog.total > 0
              ? Math.round(
                  (prog.traites /
                    prog.total) *
                    100
                )
              : 0

          const termine =
            !enChargement &&
            prog.total > 0 &&
            prog.traites === prog.total

          return (
            <div
              key={m.id}
              className="mb-4 pb-3 border-bottom"
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <strong>
                    {m.icone} {m.label}
                  </strong>
                </div>

                <div>
                  {enChargement ? (
                    <span className="badge bg-secondary">
                      Collecte des IDs...
                    </span>
                  ) : prog.total === 0 ? (
                    <span className="badge bg-light text-dark">
                      Vide
                    </span>
                  ) : termine ? (
                    <span className="badge bg-success">
                      ✓{' '}
                      {prog.supprimes ??
                        prog.traites}{' '}
                      supprimé
                      {(
                        prog.supprimes ??
                        prog.traites
                      ) > 1
                        ? 's'
                        : ''}
                    </span>
                  ) : (
                    <span className="badge bg-primary">
                      {prog.traites} /{' '}
                      {prog.total}
                    </span>
                  )}
                </div>
              </div>

              <div className="progress mb-2">
                {enChargement ? (
                  <div
                    className="
                      progress-bar
                      progress-bar-striped
                      progress-bar-animated
                    "
                    role="progressbar"
                    style={{
                      width: '100%',
                    }}
                  >
                    Chargement...
                  </div>
                ) : (
                  <div
                    className={`progress-bar ${
                      termine
                        ? 'bg-success'
                        : 'bg-primary'
                    }`}
                    role="progressbar"
                    style={{
                      width:
                        prog.total === 0
                          ? '100%'
                          : `${pct}%`,
                    }}
                  >
                    {prog.total === 0
                      ? '0'
                      : `${pct}%`}
                  </div>
                )}
              </div>

              <div className="small text-muted">
                {m.endpoints
                  .map((ep) => ep.label)
                  .join(' • ')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)
}

function PhaseRapport({
  resultats,
  erreurGlobale,
  onRecommencer,
}: {
  resultats: ResultatModule[]
  erreurGlobale: string | null
  onRecommencer: () => void
}) {
  const totalSupprimes = resultats.reduce((s, r) => s + r.supprimes, 0)
  const totalEchecs = resultats.reduce((s, r) => s + r.echecs.filter((e) => e.id > 0).length, 0)

  return (
  <div>
    {erreurGlobale ? (
      <div className="alert alert-danger">
        <strong>Erreur :</strong> {erreurGlobale}
      </div>
    ) : (
      <div className="alert alert-success">
        <strong>Réinitialisation terminée</strong>

        <div className="mt-2">
          {totalSupprimes} entrée
          {totalSupprimes > 1 ? 's' : ''} supprimée
          {totalSupprimes > 1 ? 's' : ''}
          {totalEchecs > 0 && (
            <>
              {' '}
              • {totalEchecs} échec
              {totalEchecs > 1 ? 's' : ''}
            </>
          )}
        </div>
      </div>
    )}

    {resultats.length > 0 && (
      <div className="row g-3 mb-4">
        {resultats.map((res) => {
          const config = MODULES_RESET.find(
            (m) => m.id === res.moduleId
          )

          const echecsReels =
            res.echecs.filter(
              (e) => e.id > 0
            )

          const echecsListing =
            res.echecs.filter(
              (e) => e.id === 0
            )

          return (
            <div
              key={res.moduleId}
              className="col-12"
            >
              <div className="card shadow-sm border-0">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <div>
                      <h5 className="mb-1">
                        <i className={`${config?.icone} me-1`} aria-hidden="true" />
                        {res.label}
                      </h5>
                    </div>

                    <div className="d-flex gap-2 flex-wrap">
                      <span className="badge bg-success">
                        {res.supprimes} supprimé
                        {res.supprimes > 1
                          ? 's'
                          : ''}
                      </span>

                      {echecsReels.length >
                        0 && (
                        <span className="badge bg-danger">
                          {
                            echecsReels.length
                          }{' '}
                          échec
                          {echecsReels.length >
                          1
                            ? 's'
                            : ''}
                        </span>
                      )}

                      {echecsListing.length >
                        0 && (
                        <span className="badge bg-warning text-dark">
                          Listing KO
                        </span>
                      )}
                    </div>
                  </div>

                  {res.echecs.length >
                    0 && (
                    <div className="mt-3">
                      <h6 className="text-danger mb-3">
                        Détails des erreurs
                      </h6>

                      <div className="table-responsive">
                        <table className="table table-sm table-striped">
                          <thead>
                            <tr>
                              <th>
                                Endpoint
                              </th>
                              <th>
                                ID
                              </th>
                              <th>
                                Erreur
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {res.echecs.map(
                              (
                                e,
                                i
                              ) => (
                                <tr
                                  key={
                                    i
                                  }
                                >
                                  <td>
                                    <code>
                                      {
                                        e.endpoint
                                      }
                                    </code>
                                  </td>

                                  <td>
                                    {e.id >
                                    0
                                      ? e.id
                                      : '—'}
                                  </td>

                                  <td>
                                    {
                                      e.erreur
                                    }
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )}

    <div className="d-flex justify-content-end">
      <button
        className="btn btn-primary"
        onClick={onRecommencer}
      >
        Nouvelle réinitialisation
      </button>
    </div>
  </div>
)
}
