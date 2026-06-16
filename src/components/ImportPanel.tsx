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
  // Si coché, le ZIP d'images est ignoré (validation + import) même s'il est
  // chargé : aucune image ne sera rattachée en document.
  const [ignorerImages, setIgnorerImages] = useState(false)

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
      // ZIP ignoré si la case « ne pas importer les images » est cochée.
      const imagesZip =
        fichiers.imagesZip && !ignorerImages ? await fichiers.imagesZip.arrayBuffer() : null
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
    setIgnorerImages(false)
    setPhase('selection')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-upload" aria-hidden="true" /> Import CSV</h2>
      </div>

      {phase === 'selection' && (
        <PhaseSelection
          fichiers={fichiers}
          occupe={occupe}
          auMoinsUn={auMoinsUn}
          erreurGlobale={erreurGlobale}
          ignorerImages={ignorerImages}
          onChoisir={choisir}
          onToggleIgnorerImages={setIgnorerImages}
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
  ignorerImages,
  onChoisir,
  onToggleIgnorerImages,
  onValider,
}: {
  fichiers: Fichiers
  occupe: boolean
  auMoinsUn: boolean
  erreurGlobale: string | null
  ignorerImages: boolean
  onChoisir: (cle: keyof Fichiers, file: File | null) => void
  onToggleIgnorerImages: (v: boolean) => void
  onValider: () => void
}) {
  return (
    <div>
      <p className="muted reset-intro">
        Sélectionnez une ou plusieurs feuilles CSV (et éventuellement le ZIP d'images), puis lancez
        la validation. Chaque feuille peut être importée seule, mais une feuille qui en référence une
        autre (Tickets → Inventaire, Coûts → Tickets) exige que la feuille référencée soit aussi
        fournie. Aucune écriture dans GLPI n'a lieu tant que la validation n'est pas réussie.
      </p>

      <div className="import-inputs">
        {CHAMPS.map((c) => {
          const f = fichiers[c.cle]
          const estImage = c.cle === 'imagesZip'
          const ignore = estImage && ignorerImages
          return (
            <div
              key={c.cle}
              className={`import-input${f && !ignore ? ' rempli' : ''}${ignore ? ' ignore' : ''}`}
            >
              {/* Zone cliquable = sélection de fichier (label interne pour ne pas
                  englober la case à cocher dans le déclencheur du file picker). */}
              <label className="import-input-file">
                <div className="import-input-head">
                  <span className="import-input-label">{c.label}</span>
                  <span className="muted import-input-aide">{c.aide}</span>
                </div>
                <input
                  type="file"
                  accept={c.accept}
                  onChange={(e) => onChoisir(c.cle, e.target.files?.[0] ?? null)}
                />
                <span className="import-input-nom">
                  {f ? (<><i className="bi bi-file-earmark-text" aria-hidden="true" /> {f.name}</>) : 'Aucun fichier'}
                </span>
              </label>

              {/* Case « ne pas importer les images » : toujours présente sur
                  l'entrée image. Cochée → le ZIP est conservé mais ignoré. */}
              {estImage && (
                <label className="import-input-skip">
                  <input
                    type="checkbox"
                    checked={ignorerImages}
                    onChange={(e) => onToggleIgnorerImages(e.target.checked)}
                  />
                  Ne pas importer les images (fichier conservé mais ignoré)
                </label>
              )}
            </div>
          )
        })}
      </div>

      {erreurGlobale && (
        <p className="login-error" role="alert">
          {erreurGlobale}
        </p>
      )}

      <button className="btn-reset" onClick={onValider} disabled={!auMoinsUn || occupe}>
        {occupe ? 'Validation…' : 'Valider et importer'}
      </button>
      {!auMoinsUn && <p className="muted small">Sélectionnez au moins une feuille CSV.</p>}
    </div>
  )
}

// ─── Phase : erreurs de validation ───────────────────────────────────────────

function PhaseErreurs({ erreurs, onRetour }: { erreurs: ErreurValidation[]; onRetour: () => void }) {
  return (
    <div>
      <p className="reset-msg reset-msg--err">
        Validation échouée — {erreurs.length} erreur{erreurs.length > 1 ? 's' : ''}. Aucun appel à
        l'API GLPI n'a été effectué.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fichier</th>
              <th>Ligne</th>
              <th>Colonne</th>
              <th>Valeur</th>
              <th>Erreur</th>
            </tr>
          </thead>
          <tbody>
            {erreurs.map((e, i) => (
              <tr key={i}>
                <td>{e.fichier}</td>
                <td>{e.ligne ?? '—'}</td>
                <td>{e.colonne}</td>
                <td>{e.valeur || '—'}</td>
                <td>{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-ghost" onClick={onRetour} style={{ marginTop: 16 }}>
        Corriger et recommencer
      </button>
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
      <p className="reset-msg reset-msg--ok">Validation réussie. Prêt à importer dans GLPI.</p>

      {nbExistants > 0 && (
        <div className="reset-warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> <strong>{nbExistants}</strong> matériel(s) déjà présent(s) dans GLPI — ils seront{' '}
          <strong>réutilisés</strong> (pas de doublon créé). {nbNouveaux} nouveau(x) sera(ont) créé(s).
          <ul className="import-resume import-resume--grid" style={{ marginTop: 8 }}>
            {assetsExistants.map((a) => (
              <li key={`${a.itemType}-${a.id}`} className="small">
                <i className={ITEM_TYPES[a.itemType].icone} aria-hidden="true" /> {a.name} (déjà présent, #{a.id})
              </li>
            ))}
          </ul>
        </div>
      )}
      {verifDoublonsErreur && <p className="muted small">{verifDoublonsErreur}</p>}

      <ul className="import-resume">
        <li>
          <i className="bi bi-pc-display" aria-hidden="true" /> <strong>{donnees.assets.length}</strong> matériel(s) (ordinateurs / moniteurs)
          {nbExistants > 0 && (
            <span className="muted"> — {nbNouveaux} à créer, {nbExistants} réutilisé(s)</span>
          )}
        </li>
        <li><i className="bi bi-ticket-detailed" aria-hidden="true" /> <strong>{donnees.tickets.length}</strong> ticket(s)</li>
        <li><i className="bi bi-cash-coin" aria-hidden="true" /> <strong>{donnees.couts.length}</strong> coût(s) de ticket</li>
        {donnees.images.length > 0 && (
          <li>
            <i className="bi bi-image" aria-hidden="true" /> <strong>{tokenOk ? imagesLiables : 0}</strong> image(s) à rattacher en documents
            {tokenOk && imagesLiables !== donnees.images.length && (
              <span className="muted"> ({donnees.images.length - imagesLiables} sans asset)</span>
            )}
          </li>
        )}
      </ul>

      {liens > 0 && tokenOk && (
        <p className="muted small">
          <i className="bi bi-link-45deg" aria-hidden="true" /> {liens} lien(s) matériel↔ticket seront rattachés (relation Item_Ticket, via l'API legacy).
        </p>
      )}
      {liens > 0 && !tokenOk && (
        <div className="reset-warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {liens} lien(s) matériel↔ticket non importés : définissez{' '}
          <strong>VITE_GLPI_USER_TOKEN</strong> dans <code>.env</code> pour les rattacher.
        </div>
      )}

      {donnees.images.length > 0 && !tokenOk && (
        <div className="reset-warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> Upload d'images désactivé : définissez <strong>VITE_GLPI_USER_TOKEN</strong> dans
          <code> .env</code> pour rattacher les images en documents.
        </div>
      )}

      {donnees.imagesSansAsset.length > 0 && (
        <p className="muted small">
          Images sans asset correspondant : {donnees.imagesSansAsset.join(', ')}
        </p>
      )}
      {donnees.assetsSansImage.length > 0 && (
        <p className="muted small">
          Assets sans image : {donnees.assetsSansImage.join(', ')}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="btn-ghost" onClick={onRetour}>
          Retour
        </button>
        <button className="btn-reset" onClick={onConfirmer}>
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
    <div>
      <p className="muted reset-intro">Import en cours, veuillez patienter…</p>
      <div className="reset-progress-item">
        <div className="reset-progress-header">
          <span className="reset-progress-name">{progression?.etape ?? 'Préparation…'}</span>
          <span className="reset-progress-count">
            {progression ? `${progression.courant} / ${progression.total}` : ''}
          </span>
        </div>
        <div className="reset-progress-bar-wrap">
          <div className="reset-progress-bar-fill" style={{ width: `${pct}%` }} />
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
        <p className="reset-msg reset-msg--ok">Import terminé avec succès.</p>
      ) : (
        <p className="reset-msg reset-msg--err">
          Import interrompu{rapport.rollback ? ' — rollback effectué (éléments créés supprimés)' : ''}.
          {rapport.erreur ? ` Détail : ${rapport.erreur}` : ''}
        </p>
      )}

      <ul className="import-resume">
        <li><span className="badge-ok">{rapport.cree.materiel}</span> matériel(s) créé(s)</li>
        {rapport.materielReutilise > 0 && (
          <li><span className="badge-ok">{rapport.materielReutilise}</span> matériel(s) déjà présent(s) réutilisé(s)</li>
        )}
        <li><span className="badge-ok">{rapport.cree.tickets}</span> ticket(s)</li>
        <li><span className="badge-ok">{rapport.cree.couts}</span> coût(s)</li>
        <li><span className="badge-ok">{rapport.cree.documents}</span> image(s) rattachée(s) en documents</li>
        <li><span className="badge-ok">{rapport.cree.liens}</span> lien(s) matériel↔ticket</li>
        <li><span className="badge-ok">{rapport.cree.listes}</span> entrée(s) de liste créée(s)</li>
        <li><span className="badge-ok">{rapport.cree.utilisateurs}</span> utilisateur(s) créé(s)</li>
        {(rapport.liensIgnores > 0 || rapport.imagesIgnorees > 0) && (
          <li className="muted">
            Non importés : {rapport.liensIgnores} lien(s) matériel↔ticket, {rapport.imagesIgnorees}{' '}
            image(s)
          </li>
        )}
      </ul>

      {rapport.liensEchecs.length > 0 && (
        <div className="reset-warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {rapport.liensEchecs.length} lien(s) matériel↔ticket non importé(s) (sans bloquer l'import) :
          <ul className="import-resume import-resume--grid" style={{ marginTop: 8 }}>
            {rapport.liensEchecs.map((m, i) => (
              <li key={i} className="small">{m}</li>
            ))}
          </ul>
        </div>
      )}

      {rapport.liensIgnoresInfo.length > 0 && (
        <div className="reset-msg">
          <i className="bi bi-info-circle" aria-hidden="true" /> {rapport.liensIgnoresInfo.length} lien(s) ignoré(s) — type non associable aux tickets
          dans GLPI (normal, ce n'est pas une erreur) :
          <ul className="import-resume import-resume--grid" style={{ marginTop: 8 }}>
            {rapport.liensIgnoresInfo.map((m, i) => (
              <li key={i} className="small">{m}</li>
            ))}
          </ul>
        </div>
      )}

      {rapport.imagesEchecs.length > 0 && (
        <div className="reset-warning">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {rapport.imagesEchecs.length} image(s) non importée(s) (sans bloquer l'import) :
          <ul className="import-resume import-resume--grid" style={{ marginTop: 8 }}>
            {rapport.imagesEchecs.map((m, i) => (
              <li key={i} className="small">{m}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn-ghost" onClick={onRecommencer}>
        Nouvel import
      </button>
    </div>
  )
}
