# À faire — Détail des mouvements par matériel (page /couts)

Objectif : sur [/couts](http://localhost:5173/couts), rendre chaque ligne **Matériel**
cliquable. Au clic, afficher dans une modale **tous les `mvt` (mouvements de statut)**
réalisés sur les tickets rattachés à ce type de matériel (PC, Moniteur, Téléphone…).

## Définition d'un « mvt »

Un mouvement = un **changement de statut** d'un ticket (réouverture, mise en cours,
clôture…). C'est exactement l'historique déjà affiché dans la fiche Kanban.

- Source : `getHistoriqueStatut(ticketId)` → `ChangementStatut[]` (ancien → nouveau, date, auteur)
  dans [src/services/ticketsApi.ts](src/services/ticketsApi.ts) (lit `glpi_logs` via l'API legacy).
- Lien ticket ↔ matériel : sous-items `Item_Ticket` via `getSousItemsLegacy('Ticket', id, 'Item_Ticket')`
  — **déjà utilisé** dans `chargerCoutsParMateriel` ([src/services/coutsApi.ts](src/services/coutsApi.ts)).
- On ramène chaque statut à sa colonne Kanban (Nouveau / In progress / Terminé) et on **masque
  les transitions internes** (même colonne) pour ne garder que les vrais mouvements.

> ⚠️ Prérequis : `VITE_GLPI_USER_TOKEN` doit être configuré (l'historique passe par l'API
> legacy). Sinon `getHistoriqueStatut` renvoie `[]` → la modale affichera « aucun mouvement ».

---

## Tâches

### 1. CRÉER le service `src/services/mvtApi.ts`

Agrège les mouvements de tous les tickets, regroupés par `itemtype` de matériel.

```ts
// Mouvements (changements de statut) regroupés par type de matériel.
// Réutilise l'historique de statut (glpi_logs) + les liens Item_Ticket.
import { getSousItemsLegacy } from './legacyApi'
import { listerTicketsFront } from './ticketsFrontApi'
import { getHistoriqueStatut } from './ticketsApi'
import { pool } from './concurrency'
import { TYPES_MATERIEL } from './coutsApi'

export interface MouvementMateriel {
  ticketId: number
  date: string
  auteur: string
  de: string   // colonne de départ ('Création' si premier statut)
  vers: string // colonne d'arrivée
}

// Statut GLPI → colonne Kanban (1 Nouveau · 2/3/4/10 In progress · 5/6 Terminé).
const COLONNE: Record<number, string> = {
  1: 'Nouveau', 2: 'In progress', 3: 'In progress', 4: 'In progress', 10: 'In progress',
  5: 'Terminé', 6: 'Terminé',
}
const libelle = (id?: number): string => (id ? (COLONNE[id] ?? `Statut ${id}`) : '')

/** Mouvements de statut de tous les tickets, regroupés par itemtype de matériel. */
export async function chargerMvtParMateriel(): Promise<Record<string, MouvementMateriel[]>> {
  const out: Record<string, MouvementMateriel[]> = {}
  for (const t of TYPES_MATERIEL) out[t.itemtype] = []

  const tickets = await listerTicketsFront()
  await pool(tickets, 6, async (ticket) => {
    try {
      const liens = await getSousItemsLegacy('Ticket', ticket.id, 'Item_Ticket')
      const types = [...new Set(liens.map((l) => String(l.itemtype ?? '')))].filter((it) => out[it])
      if (types.length === 0) return

      const hist = await getHistoriqueStatut(ticket.id)
      for (const c of hist) {
        const de = libelle(c.ancien)
        const vers = libelle(c.nouveau)
        if (!vers || de === vers) continue // on ignore le bruit (même colonne)
        for (const it of types) {
          out[it].push({ ticketId: ticket.id, date: c.date, auteur: c.auteur, de: de || 'Création', vers })
        }
      }
    } catch { /* best-effort : un ticket en erreur ne casse pas l'agrégat */ }
  })

  // Plus récents en premier, par type.
  for (const it of Object.keys(out)) {
    out[it].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
  return out
}
```

### 2. MODIFIER `src/components/front/CoutsPanel.tsx`

Charger les mouvements, rendre chaque ligne cliquable, afficher une modale au clic.

**a. Imports — après la ligne 3** (`import type { CoutMateriel }…`) :
```ts
import { chargerMvtParMateriel } from '../../services/mvtApi'
import type { MouvementMateriel } from '../../services/mvtApi'
import { formatDate } from '../../format'
```

**b. État + chargement — dans `CoutsPanel`, après la ligne `const [erreur, setErreur]…` (ligne 14)** :
```ts
const [mvts, setMvts] = useState<Record<string, MouvementMateriel[]>>({})
// itemtype + libellé du matériel sélectionné (modale ouverte si non-null).
const [selection, setSelection] = useState<{ itemtype: string; libelle: string } | null>(null)
```

**c. Charger les mvt — étendre le `useEffect` existant** (ligne 16). Le plus simple :
ajouter, juste avant `return () => { actif = false }`, l'appel :
```ts
chargerMvtParMateriel().then((m) => { if (actif) setMvts(m) }).catch(() => {})
```

**d. Mapper itemtype ↔ libellé.** Le tableau affiche `ligne.libelle` (« PC »…) mais l'agrégat
est indexé par `itemtype` (« Computer »…). Importer `TYPES_MATERIEL` :
```ts
import { TYPES_MATERIEL } from '../../services/coutsApi'
```
puis un helper dans le composant :
```ts
const itemtypePour = (libelle: string) =>
  TYPES_MATERIEL.find((t) => t.libelle === libelle)?.itemtype ?? ''
```

**e. Rendre la ligne cliquable — sur le `<tr key={ligne.libelle}>` (ligne 56)** :
```tsx
<tr
  key={ligne.libelle}
  className="row-clickable"
  onClick={() => setSelection({ itemtype: itemtypePour(ligne.libelle), libelle: ligne.libelle })}
>
```
(Optionnel : ajouter `title="Voir les mouvements"` pour l'accessibilité.)

**f. Modale — juste avant la fermeture `</section>`** :
```tsx
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
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={() => setSelection(null)}>Fermer</button>
      </div>
    </div>
  </div>
)}
```

### 3. (Optionnel) MODIFIER `src/App.css` — curseur sur les lignes cliquables

```css
.row-clickable { cursor: pointer; }
.row-clickable:hover { background: var(--row-hover, rgba(0,0,0,.04)); }
```
Les classes `modal-overlay`, `modal-card`, `modal-head`, `modal-body`, `modal-actions`,
`data-table` existent déjà (réutilisées du Kanban / des panneaux) — rien à créer côté CSS.

---

## Vérification

1. `npm run dev` dans `GLPI_NewApp`, vérifier que `VITE_GLPI_USER_TOKEN` est défini dans `.env`.
2. Aller sur `/couts`, cliquer sur une ligne (ex. « PC »).
3. La modale liste les mouvements (ticket, date, transition, auteur) des tickets rattachés à
   un Computer.
4. Cliquer sur un matériel sans ticket → message « Aucun mouvement enregistré ».

## Points d'attention

- **Coût réseau** : on relit l'historique de chaque ticket lié (1 requête legacy/ticket). C'est
  borné par `pool(…, 6, …)`. Sur de gros volumes, envisager un endpoint d'agrégat côté
  `kanban-api` plutôt que N appels front.
- **Annulation vs réouverture** : les logs `glpi_logs` ne distinguent pas ces deux actions
  (toutes deux Terminé → In progress). La transition affichée est donc « Terminé → In progress »
  dans les deux cas ; si on veut les différencier, il faudra tracer le mvt côté `kanban-api`
  (table dédiée au moment de l'import / du drag).
- Un ticket lié à plusieurs matériels apparaît dans CHAQUE type concerné (comportement voulu,
  cohérent avec la répartition des coûts existante).
