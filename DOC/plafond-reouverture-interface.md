# Interface — Modifier le plafond de réouverture (`/admin` → Édition des coûts)

Ce document décrit **uniquement la partie interface** ajoutée pour modifier le
plafond de réouverture depuis la page **Édition des coûts**. Le champ écrit la
valeur dans la base (paramètre global `plafond_reouverture`) et déclenche le
recalcul de tous les tickets côté backend.

---

## 1. Où ça se trouve

Dans [`EditionCoutsPanel.tsx`](../src/components/front/EditionCoutsPanel.tsx), un
encart est affiché **en haut de la page**, juste sous le titre « Édition des
coûts » et avant le tableau des opérations.

```
┌─ Édition des coûts ─────────────────────────────────────────┐
│  🛡️ Plafond de réouverture (% du super coût)                │
│  ┌──────────────┐  ┌────────────┐                           │
│  │ 20           │  │ Enregistrer│                           │
│  └──────────────┘  └────────────┘                           │
│  Le total des frais de réouverture d'un ticket ne dépassera │
│  pas ce pourcentage de son super coût. Laisser vide pour ne │
│  pas plafonner. La modification recalcule tous les tickets. │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Comportement de l'interface

| Action | Effet |
|---|---|
| Ouverture de la page | Le champ est pré-rempli avec le plafond courant lu en base (vide si aucun plafond). |
| Saisir une valeur (ex. `20`) + **Enregistrer** | Enregistre `plafond_reouverture = 20` puis recharge : les frais sont re-plafonnés et le tableau se rafraîchit. |
| Vider le champ + **Enregistrer** | Supprime le plafond (aucun blocage). |
| Pendant l'enregistrement | Le bouton affiche « Enregistrement… » et est désactivé. |

---

## 3. État React (composant `EditionCoutsPanel`)

```ts
const [plafond, setPlafond] = useState('')          // valeur du champ (chaîne)
const [plafondEnCours, setPlafondEnCours] = useState(false)  // verrou du bouton
```

Chargement initial (dans `recharger()`), en parallèle des events :

```ts
const [evenements, tickets, valeurPlafond] = await Promise.all([
  chargerEvents(),
  listerTicketsFront(),
  chargerPlafond(),
])
setPlafond(valeurPlafond === null ? '' : String(valeurPlafond))
```

Enregistrement (`enregistrerPlafond()`) — vide = `null` = aucun plafond :

```ts
const valeur = plafond.trim() === '' ? null : Number(plafond)
await definirPlafond(valeur === null || Number.isNaN(valeur) ? null : valeur)
await recharger()  // le backend a recalculé : on relit l'état à jour
```

---

## 4. Le markup (JSX)

```tsx
{etat === 'ready' && (
  <div className="plafond-editor">
    <label className="modal-label" htmlFor="edit-plafond">
      <i className="bi bi-shield-check" aria-hidden="true" /> Plafond de réouverture (% du super coût)
    </label>
    <div className="plafond-editor__row">
      <input
        id="edit-plafond"
        type="number"
        min={0}
        step="any"
        className="modal-input"
        placeholder="Aucun plafond"
        value={plafond}
        onChange={(champ) => setPlafond(champ.target.value)}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={plafondEnCours}
        onClick={enregistrerPlafond}
      >
        {plafondEnCours ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
    <p className="muted">…texte d'aide…</p>
  </div>
)}
```

Conventions respectées : icône **bootstrap-icons** (`bi bi-shield-check`, pas
d'emoji dans le code), classes existantes réutilisées (`modal-label`,
`modal-input`, `btn-primary`, `muted`).

---

## 5. Service front appelé

[`coutEventsApi.ts`](../src/services/coutEventsApi.ts) :

```ts
chargerPlafond(): Promise<number | null>   // GET  /kanban-api/ticket-fixed-costs/plafond
definirPlafond(valeur: number | null)      // PUT  /kanban-api/ticket-fixed-costs/plafond[?valeur=20]
```

`valeur = null` → appel sans paramètre → le backend supprime le plafond.

---

## 6. Styles

[`App.css`](../src/App.css) — encart `.plafond-editor` (fond `--accent-bg`,
bordure `--border`, coins arrondis) et `.plafond-editor__row` (champ + bouton
alignés horizontalement, champ limité à 200px).

---

> Côté serveur (non couvert ici) : l'écriture en base et le recalcul des tickets
> sont gérés par `TicketFixedCostController` / `TicketFixedCostService`.
