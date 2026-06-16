# À faire — Page d'import CSV des mouvements de tickets

Objectif : une page où on importe un CSV à **3 colonnes** et on rejoue, en masse, les
scénarios déjà gérés à la main dans le Kanban (réouverture / annulation / clôture).

## Format du CSV

| colonne 1 | colonne 2 | colonne 3 |
|-----------|-----------|-----------|
| `ticket`  | `mvt`     | `valeur`  |

- **ticket** : identifiant GLPI du ticket (nombre).
- **mvt** : le mouvement. Valeurs acceptées :
  - `reopened` / `reouverture` → **réouverture** (valeur = pourcentage du dernier coût).
  - `cancel` / `annuler` / `annulation` → **annulation** (clôture erronée : on rouvre et on
    supprime le coût). **La colonne `valeur` est ignorée.**
  - `close` / `terminer` → **clôture** (valeur = texte de la solution).
- **valeur** : pourcentage (réouverture) ou solution (clôture) ; ignorée si `mvt = cancel`.

Exemple :
```csv
ticket,mvt,valeur
12,reopened,50
12,cancel,
13,close,Remplacement du disque dur
```

## Correspondance avec l'existant (déjà codé, on réutilise)

Tout existe déjà dans le Kanban — voir [src/components/front/KanbanBoard.tsx](src/components/front/KanbanBoard.tsx)
`confirmerReouverture` / `annulerCloture` / `confirmerInfo` :

| mvt        | appels                                                                    |
|------------|---------------------------------------------------------------------------|
| reopened   | `changerStatutTicket(id, 2)` puis `appliquerReouverture(id, valeur)`       |
| cancel     | `changerStatutTicket(id, 2)` puis `annulerDernierCoutFixe(id)`            |
| close      | `resoudreTicket(id, valeur)`                                               |

- `changerStatutTicket`, `resoudreTicket` → [src/services/ticketsFrontApi.ts](src/services/ticketsFrontApi.ts)
- `appliquerReouverture`, `annulerDernierCoutFixe` → [src/services/coutsApi.ts](src/services/coutsApi.ts)
- Parsing CSV (gère guillemets/virgules) → `analyserCsv` dans [src/services/csvUtil.ts](src/services/csvUtil.ts)

---

## Tâches

### 1. CRÉER le service `src/services/importMvtApi.ts`

Parse le CSV et applique chaque ligne en réutilisant les fonctions existantes.

```ts
// Import CSV des mouvements de tickets — réutilise la logique métier du Kanban.
import { analyserCsv } from './csvUtil'
import { changerStatutTicket, resoudreTicket } from './ticketsFrontApi'
import { annulerDernierCoutFixe, appliquerReouverture } from './coutsApi'

export type MvtType = 'reopened' | 'cancel' | 'close'

export interface LigneImport {
  numLigne: number
  ticket: number
  mvt: MvtType
  valeur: string
}

export interface ResultatLigne {
  numLigne: number
  ticket: number
  mvt: string
  ok: boolean
  message: string
}

/** Normalise le libellé du mouvement (FR/EN, casse libre) vers un type canonique. */
function normaliserMvt(brut: string): MvtType | null {
  const v = brut.trim().toLowerCase()
  if (['reopened', 'reouverture', 'réouverture'].includes(v)) return 'reopened'
  if (['cancel', 'annuler', 'annulation'].includes(v)) return 'cancel'
  if (['close', 'terminer', 'cloturer', 'clôturer', 'closed'].includes(v)) return 'close'
  return null
}

/** Analyse le CSV (3 colonnes) : lignes valides d'un côté, erreurs de format de l'autre. */
export function parserImportMvt(contenu: string): { lignes: LigneImport[]; erreurs: ResultatLigne[] } {
  const { lignes } = analyserCsv(contenu)
  const ok: LigneImport[] = []
  const erreurs: ResultatLigne[] = []
  for (const { numLigne, valeurs } of lignes) {
    const ticket = Number((valeurs[0] ?? '').trim())
    const mvt = normaliserMvt(valeurs[1] ?? '')
    const valeur = (valeurs[2] ?? '').trim()
    if (!ticket || !mvt) {
      erreurs.push({ numLigne, ticket, mvt: valeurs[1] ?? '', ok: false, message: 'Ticket ou mouvement invalide' })
      continue
    }
    ok.push({ numLigne, ticket, mvt, valeur })
  }
  return { lignes: ok, erreurs }
}

/** Applique une ligne. Si mvt = cancel, la valeur n'est PAS prise en compte. */
export async function appliquerLigne(l: LigneImport): Promise<ResultatLigne> {
  try {
    if (l.mvt === 'reopened') {
      await changerStatutTicket(l.ticket, 2)
      await appliquerReouverture(l.ticket, Number(l.valeur) || 0)
    } else if (l.mvt === 'cancel') {
      await changerStatutTicket(l.ticket, 2)
      await annulerDernierCoutFixe(l.ticket) // valeur ignorée
    } else {
      await resoudreTicket(l.ticket, l.valeur || 'Clôturé via import')
    }
    return { numLigne: l.numLigne, ticket: l.ticket, mvt: l.mvt, ok: true, message: 'OK' }
  } catch (e) {
    return {
      numLigne: l.numLigne, ticket: l.ticket, mvt: l.mvt,
      ok: false, message: e instanceof Error ? e.message : 'Erreur',
    }
  }
}
```

### 2. CRÉER le composant `src/components/front/ImportMvtPanel.tsx`

Lecture du fichier, aperçu des erreurs, application séquentielle, rapport.

```tsx
import { useState } from 'react'
import { parserImportMvt, appliquerLigne } from '../../services/importMvtApi'
import type { ResultatLigne } from '../../services/importMvtApi'

export function ImportMvtPanel() {
  const [resultats, setResultats] = useState<ResultatLigne[]>([])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function onFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(''); setResultats([]); setEnCours(true)
    try {
      const contenu = await fichier.text()
      const { lignes, erreurs } = parserImportMvt(contenu)
      const out: ResultatLigne[] = [...erreurs]
      for (const l of lignes) out.push(await appliquerLigne(l)) // séquentiel : évite de surcharger GLPI
      out.sort((a, b) => a.numLigne - b.numLigne)
      setResultats(out)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Lecture du fichier impossible.')
    } finally {
      setEnCours(false)
      e.target.value = '' // permet de réimporter le même fichier
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
        Colonnes attendues : <code>ticket, mvt, valeur</code>. Mouvements : <code>reopened</code>,
        <code>cancel</code>/<code>annuler</code>, <code>close</code>/<code>terminer</code>.
        Pour <code>cancel</code>, la valeur est ignorée.
      </p>

      <input type="file" accept=".csv,text/csv" onChange={onFichier} disabled={enCours} />

      {enCours && <p className="muted">Traitement en cours…</p>}
      {erreur && <p className="login-error" role="alert">{erreur}</p>}

      {resultats.length > 0 && (
        <>
          <p className="muted">{nbOk} ligne(s) appliquée(s), {nbKo} en erreur.</p>
          <table className="data-table">
            <thead>
              <tr><th>Ligne</th><th>Ticket</th><th>Mvt</th><th>Statut</th><th>Détail</th></tr>
            </thead>
            <tbody>
              {resultats.map((r) => (
                <tr key={r.numLigne}>
                  <td>{r.numLigne}</td>
                  <td>{r.ticket || '—'}</td>
                  <td>{r.mvt}</td>
                  <td>{r.ok ? '✅' : '❌'}</td>
                  <td>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
```

### 3. MODIFIER `src/App.tsx` — déclarer la route

- **Ligne 10**, après l'import de `CoutsPanel`, ajouter :
  ```ts
  import { ImportMvtPanel } from './components/front/ImportMvtPanel'
  ```
- **Ligne 58** (juste après `<Route path="couts" … />`), ajouter la route :
  ```tsx
  <Route path="import" element={<ImportMvtPanel />} />
  ```

### 4. MODIFIER `src/components/front/FrontLayout.tsx` — entrée de menu

- Dans le tableau `NAV` (**après la ligne 13**, `/couts`), ajouter :
  ```ts
  { id: '/import', label: 'Import CSV', icon: 'bi bi-upload', group: 'Tickets' },
  ```
- Dans `PAGE_INTRO` (**après la ligne 21**), ajouter :
  ```ts
  '/import': { titre: 'Import des mouvements', sous: 'Rejouez réouvertures, annulations et clôtures depuis un CSV.' },
  ```

---

## Vérification

1. `npm run dev` dans `GLPI_NewApp`.
2. Aller sur `/import`, importer le CSV d'exemple ci-dessus.
3. Vérifier dans le Kanban que les tickets ont bien changé de statut/coût.
4. Confirmer qu'une ligne `cancel` avec une valeur renseignée ignore bien cette valeur.

## Points d'attention / améliorations possibles

- **Séquentiel** volontaire (boucle `for await`) pour ne pas saturer GLPI ; si besoin de
  vitesse, réutiliser `pool(...)` de [src/services/concurrency.ts](src/services/concurrency.ts).
- Le backend `kanban-api` doit être joignable (mêmes endpoints que le Kanban).
- Pas de transaction : une ligne en erreur n'annule pas les précédentes → le rapport final
  liste précisément les lignes KO à rejouer.
