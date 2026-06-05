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
        <h2>🗑️ Réinitialisation</h2>
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
    <div>
      <p className="muted reset-intro">
        Ressources concernées par les imports Excel/CSV (tickets, ordinateurs,
        moniteurs). Le nombre indiqué correspond aux enregistrements actuellement
        en base GLPI.
      </p>
      <div className="reset-warning">
        ⚠️ Action irréversible — ces suppressions passeront par GLPI et ne pourront pas être annulées.
      </div>

      <label className="reset-select-all">
        <input
          type="checkbox"
          checked={tousSelectionnees}
          onChange={onToggleTout}
        />
        Tout sélectionner / désélectionner
      </label>

      <div className="reset-ressources">
        {MODULES_RESET.map((m) => {
          const n = compteurs?.[m.endpoints[0].endpoint]
          const texte = compteurs == null ? '…' : n == null ? '?' : String(n)
          const labelNombre =
            compteurs == null
              ? 'Comptage…'
              : n == null
              ? 'Nombre indisponible'
              : `${n} en base`
          return (
            <label
              key={m.id}
              className={`reset-ressource-card${selectionnees.has(m.id) ? ' selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectionnees.has(m.id)}
                onChange={() => onToggle(m.id)}
              />
              <span className="reset-ressource-icone">{m.icone}</span>
              <span className="reset-module-info">
                <span className="reset-ressource-label">{m.label}</span>
                <span className="muted" style={{ fontSize: 13 }}>{m.description}</span>
              </span>
              <span className="reset-ep-count" title={labelNombre}>{texte}</span>
            </label>
          )
        })}
      </div>

      <button
        className="btn-reset"
        onClick={onLancer}
        disabled={selectionnees.size === 0}
      >
        Lancer la réinitialisation
        {selectionnees.size > 0 && (
          <span className="btn-reset-count"> ({selectionnees.size} module{selectionnees.size > 1 ? 's' : ''})</span>
        )}
      </button>
    </div>
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
  const totalEndpoints = modules.reduce((s, m) => s + m.endpoints.length, 0)

  return (
    <div className="reset-dialog">
      <h3>⚠️ Confirmer la réinitialisation</h3>
      <p>
        Vous allez supprimer définitivement toutes les entrées de{' '}
        <strong>{totalEndpoints} type{totalEndpoints > 1 ? 's' : ''} de ressource</strong>{' '}
        répartis dans les modules suivants :
      </p>
      <ul className="reset-dialog-list">
        {modules.map((m) => (
          <li key={m.id}>
            {m.icone} <strong>{m.label}</strong>
            <span className="muted"> — {m.endpoints.map((e) => e.label).join(', ')}</span>
          </li>
        ))}
      </ul>
      <p>
        Cette action est <strong>irréversible</strong> et ne peut pas être annulée.
      </p>
      <div className="reset-confirm-field">
        <label htmlFor="reset-input">
          Tapez <strong>RESET</strong> pour confirmer
        </label>
        <input
          id="reset-input"
          type="text"
          value={motConfirmation}
          onChange={(e) => onChangeMot(e.target.value)}
          placeholder="RESET"
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>
      <div className="reset-dialog-actions">
        <button className="btn-ghost" onClick={onAnnuler}>
          Annuler
        </button>
        <button
          className="btn-reset"
          onClick={onConfirmer}
          disabled={motConfirmation !== 'RESET'}
        >
          Confirmer la suppression
        </button>
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
      <p className="muted reset-intro">Réinitialisation en cours, veuillez patienter…</p>
      <div className="reset-progress-list">
        {modules.map((m) => {
          const prog = progressions[m.id] ?? { total: 0, traites: 0 }
          const enChargement = chargementIds.has(m.id)
          const pct = prog.total > 0 ? Math.round((prog.traites / prog.total) * 100) : 0

          return (
            <div key={m.id} className="reset-progress-item">
              <div className="reset-progress-header">
                <span className="reset-progress-name">
                  {m.icone} {m.label}
                </span>
                <span className="reset-progress-count">
                  {enChargement
                    ? 'Collecte des IDs…'
                    : prog.total === 0
                    ? 'Vide'
                    : prog.traites === prog.total
                    ? `✓ ${prog.supprimes ?? prog.traites} supprimé${prog.traites !== 1 ? 's' : ''}`
                    : `${prog.traites} / ${prog.total}`}
                </span>
              </div>
              <div className="reset-progress-bar-wrap">
                <div
                  className="reset-progress-bar-fill"
                  style={{
                    width: enChargement ? '0%' : prog.total === 0 ? '100%' : `${pct}%`,
                    opacity: prog.total === 0 && !enChargement ? 0.3 : 1,
                  }}
                />
              </div>
              <span className="reset-progress-eps muted">
                {m.endpoints.map((ep) => ep.label).join(' · ')}
              </span>
            </div>
          )
        })}
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
        <p className="reset-msg reset-msg--err">Erreur : {erreurGlobale}</p>
      ) : (
        <p className="reset-msg reset-msg--ok">
          Réinitialisation terminée —{' '}
          <strong>{totalSupprimes} entrée{totalSupprimes !== 1 ? 's' : ''} supprimée{totalSupprimes !== 1 ? 's' : ''}</strong>
          {totalEchecs > 0 && (
            <span className="reset-msg-echecs">
              {' '}· {totalEchecs} échec{totalEchecs !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      )}

      {resultats.length > 0 && (
        <div className="reset-rapport-list">
          {resultats.map((res) => {
            const config = MODULES_RESET.find((m) => m.id === res.moduleId)
            const echecsReels = res.echecs.filter((e) => e.id > 0)
            const echecsListing = res.echecs.filter((e) => e.id === 0)

            return (
              <div key={res.moduleId} className="reset-rapport-item">
                <div className="reset-rapport-header">
                  <span className="reset-rapport-name">
                    {config?.icone} {res.label}
                  </span>
                  <span className="badge-ok">
                    {res.supprimes} supprimé{res.supprimes !== 1 ? 's' : ''}
                  </span>
                  {echecsReels.length > 0 && (
                    <span className="badge-err">
                      {echecsReels.length} échec{echecsReels.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {echecsListing.length > 0 && (
                    <span className="badge-err">listing KO</span>
                  )}
                </div>

                {res.echecs.length > 0 && (
                  <div className="reset-rapport-echecs">
                    <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>
                      Détails des échecs :
                    </p>
                    <ul className="reset-echec-list">
                      {res.echecs.map((e, i) => (
                        <li key={i}>
                          <em>{e.endpoint}</em>
                          {e.id > 0 ? ` ID ${e.id}` : ''} — {e.erreur}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button className="btn-ghost" onClick={onRecommencer}>
        Nouvelle réinitialisation
      </button>
    </div>
  )
}
