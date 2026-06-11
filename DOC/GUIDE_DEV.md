# Guide développeur — GLPI_NewApp

Mémo pratique pour développer **from scratch** dans cette appli (React 19 + TypeScript + Vite + React Router 7). Tout est calqué sur les conventions déjà en place dans `src/`. Garde-le ouvert à côté de ton éditeur.

> ⚠️ **Règle d'or** : on ne touche **jamais** au cœur de GLPI (`glpi/src`, config, DB). Tout le dev se fait dans `GLPI_NewApp/`.

---

## 1. Démarrage

```bash
cd GLPI_NewApp
npm install
cp .env.example .env   # puis remplir les valeurs (client OAuth, tokens…)
npm run dev            # http://localhost:5173
```

| Commande | Rôle |
|----------|------|
| `npm run dev` | Serveur Vite + hot reload |
| `npm run build` | `tsc -b` (vérif types) puis build prod dans `dist/` |
| `npm run lint` | ESLint sur tout le projet |
| `npm run preview` | Sert le build de prod localement |

**Toujours lancer `npm run build` avant de considérer une feature finie** : c'est ce qui attrape les erreurs TypeScript que `dev` peut laisser passer.

---

## 2. Architecture des dossiers

```
src/
├── main.tsx              Point d'entrée : BrowserRouter > AuthProvider > App
├── App.tsx               Toutes les routes (front / back-office)
├── config.ts             Lecture des variables d'env (.env)
├── format.ts             Helpers de formatage (dates…)
├── sections.ts           Définition des onglets back-office (data-driven)
├── index.css             Tokens de design (variables CSS :root)
├── App.css               Styles des composants
├── pages/                Une page = une route principale
├── components/           Composants UI
│   └── front/            Composants du front-office (racine /)
├── context/              React Context (auth)
└── services/             TOUT ce qui parle à l'API (fetch, types, logique métier)
```

**Principe clé : séparation UI / réseau.**
- Un composant `.tsx` ne fait **jamais** de `fetch` brut.
- Il appelle une fonction d'un fichier `services/*.ts`.
- Les services exportent des fonctions typées + les types associés.

---

## 3. Routing (React Router 7)

Tout est déclaré dans [App.tsx](../src/App.tsx). Deux univers :

- `/` → **front-office** (auto-login, aucun compte visible)
- `/admin` → **back-office** (réservé aux profils admin)
- `/login` → connexion back-office

### Ajouter une page

1. Crée le composant dans `pages/` ou `components/front/`.
2. Ajoute une `<Route>` :

```tsx
// Route enfant du front-office (hérite du FrontLayout)
<Route path="/" element={<FrontAutoLogin />}>
  <Route element={<FrontLayout />}>
    <Route index element={<ElementsPanel />} />
    <Route path="ma-page" element={<MaPage />} />   {/* /ma-page */}
  </Route>
</Route>
```

### Naviguer

```tsx
import { useNavigate, Link } from 'react-router-dom'

const navigate = useNavigate()
navigate('/tickets/create')          // par code
navigate('/admin', { replace: true }) // sans empiler dans l'historique

<Link to="/kanban">Voir le Kanban</Link>  // dans le JSX
```

### Lire un paramètre d'URL

```tsx
import { useParams } from 'react-router-dom'
const { section } = useParams()   // pour /admin/:section
```

---

## 4. Faire une popup / modale React

C'est **le** pattern le plus demandé. On suit exactement le style déjà utilisé dans [KanbanBoard.tsx](../src/components/front/KanbanBoard.tsx). Les classes CSS `modal-*` existent déjà dans [App.css](../src/App.css) — pas besoin de réécrire le style.

### Recette minimale

```tsx
import { useState } from 'react'

export function MonComposant() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Ouvrir
      </button>

      {open && <MaModale onClose={() => setOpen(false)} />}
    </>
  )
}
```

### La modale elle-même

```tsx
function MaModale({ onClose }: { onClose: () => void }) {
  return (
    // L'overlay ferme au clic en dehors de la carte
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      {/* stopPropagation : un clic DANS la carte ne ferme pas */}
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>

        <div className="modal-head">
          <h3 className="modal-title">Titre de la modale</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {/* contenu défilant si trop long */}
          <p>Mon contenu…</p>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-primary" onClick={onClose}>Confirmer</button>
        </div>
      </div>
    </div>
  )
}
```

### Classes CSS dispo (déjà stylées)

| Classe | Usage |
|--------|-------|
| `modal-overlay` | Fond semi-transparent plein écran (clic = fermeture) |
| `modal-card` | La carte blanche (max 440px) |
| `modal-card--lg` | Variante large (600px, scroll vertical) pour les fiches détaillées |
| `modal-head` | En-tête flex (titre + bouton fermer) |
| `modal-title` | Titre |
| `modal-close` | Bouton croix (mettre `<i className="bi bi-x-lg" />` dedans) |
| `modal-body` | Corps défilant |
| `modal-label` / `modal-input` | Label + champ de saisie stylés |
| `modal-actions` | Pied de modale, boutons alignés à droite |
| `modal-hint` | Petite astuce sous le titre |

### Bonnes pratiques modale

- **Fermeture au clic extérieur** : `onClick={onClose}` sur l'overlay + `e.stopPropagation()` sur la carte.
- **Fermeture clavier** : `onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}` sur le champ focusé.
- **Focus auto** à l'ouverture sur le premier champ :
  ```tsx
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  ```
- **Conditionnel** : `{open && <Modale .../>}` — on monte/démonte, on ne cache pas en CSS.

---

## 5. Hooks React — l'essentiel

### `useState` — état local

```tsx
const [name, setName] = useState('')                    // string
const [count, setCount] = useState<number | null>(null) // typé explicite
const [open, setOpen] = useState(false)

// Mise à jour basée sur l'ancienne valeur → forme fonctionnelle
setSelectedKeys((prev) => {
  const next = new Set(prev)   // toujours créer un NOUVEL objet (immutabilité)
  next.has(key) ? next.delete(key) : next.add(key)
  return next
})
```

> ⚠️ React ne re-render que si la **référence** change. Ne mute jamais un tableau/objet/Set/Map en place : crée une copie (`new Set(prev)`, `[...prev]`, `{ ...prev }`).

### `useEffect` — effets de bord (fetch, abonnements)

```tsx
useEffect(() => {
  let active = true             // garde anti-race condition
  async function charger() {
    const data = await getSession()
    if (!active) return         // composant démonté → on ignore
    setSession(data)
  }
  void charger()
  return () => { active = false }  // cleanup au démontage
}, [])  // [] = au montage uniquement ; [id] = à chaque changement d'id
```

### `useMemo` — calcul mémorisé

```tsx
// Recalculé seulement si urgency ou impact changent
const priority = useMemo(() => computePriority(urgency, impact), [urgency, impact])
```

### `useCallback` — fonction mémorisée (utile pour les contexts/props)

```tsx
const login = useCallback(async (u: string, p: string) => { /* … */ }, [])
```

### `useRef` — référence persistante (DOM ou valeur mutable)

```tsx
const inputRef = useRef<HTMLInputElement>(null)
// <input ref={inputRef} /> puis inputRef.current?.focus()
```

---

## 6. Appeler l'API GLPI

### Architecture réseau

- **Front-office** (`/`) : session OAuth propre via [frontSession.ts](../src/services/frontSession.ts) → utilise `frontApiFetch`.
- **Back-office** (`/admin`) : session admin via [apiClient.ts](../src/services/apiClient.ts) → utilise `apiFetch`.
- Le proxy Vite ([vite.config.ts](../src/../vite.config.ts)) réécrit `/api/...` → `{GLPI}/api.php/...` (gère le HTTPS auto-signé en dev).

Les deux `*Fetch` ajoutent le `Authorization: Bearer …` et **rafraîchissent automatiquement le token sur un 401**. Ne refais jamais cette plomberie à la main.

### Créer un nouveau service

Toujours dans `services/`, un fichier par domaine. Modèle :

```ts
// services/monApi.ts
import { apiFetch } from './apiClient'   // ou frontApiFetch côté front
import type { GlpiRow } from './glpiApi'

export interface MonItem {
  id: number
  name: string
}

/** Récupère la liste des items. */
export async function fetchMesItems(): Promise<MonItem[]> {
  const res = await apiFetch('/MonItemType')
  if (!res.ok) throw new Error('Échec du chargement des items.')
  return (await res.json()) as MonItem[]
}

/** Crée un item. */
export async function creerItem(name: string): Promise<number> {
  const res = await apiFetch('/MonItemType', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { name } }),
  })
  if (!res.ok) throw new Error('Échec de la création.')
  const data = await res.json()
  return data.id
}
```

### Helpers GLPI réutilisables ([glpiApi.ts](../src/services/glpiApi.ts))

| Fonction | Rôle |
|----------|------|
| `fetchList(fetchFn, endpoint, …)` | Liste paginée typée |
| `fetchCount(...)` | Nombre total |
| `fetchAllIds(...)` | Tous les IDs |
| `supprimerItem(path, id)` | Suppression |
| `refName(value)` | Extrait le nom lisible d'un objet lié GLPI |

> ⚠️ **Itemtypes namespacés** : certains types legacy exigent le namespace complet (ex. `Glpi\Socket` et non `Socket`), sinon erreur 500. Voir la mémoire `glpi-socket-namespaced-itemtype`.

### Consommer un service dans un composant

```tsx
const [items, setItems] = useState<MonItem[]>([])
const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

useEffect(() => {
  let active = true
  setStatus('loading')
  fetchMesItems()
    .then((data) => { if (active) { setItems(data); setStatus('idle') } })
    .catch(() => { if (active) setStatus('error') })
  return () => { active = false }
}, [])
```

---

## 7. Authentification (Context)

Le state d'auth est global via React Context. **Ne lis jamais les tokens directement** dans un composant : passe par le hook.

```tsx
import { useAuth } from '../context/AuthContext'

function MonComposant() {
  const { status, session, login, logout } = useAuth()

  if (status === 'loading') return <div>Chargement…</div>
  if (status !== 'authenticated') return <p>Non connecté</p>

  return <p>Bonjour {session?.active_profile?.name}</p>
}
```

- `status` : `'loading' | 'authenticated' | 'unauthenticated'`
- `login(username, password)` / `logout()`
- Le `AuthProvider` ([context/AuthProvider.tsx](../src/context/AuthProvider.tsx)) restaure la session au démarrage.

### Créer ton propre context (modèle)

1. `MyContext.tsx` : `createContext` + hook `useMyThing()` qui throw si hors provider.
2. `MyProvider.tsx` : le composant qui détient le state et `value={…}`.
3. Monter le provider dans `main.tsx` (ou plus bas selon la portée).

---

## 8. Conventions de design

> Voir aussi la mémoire `glpinewapp-design-conventions`.

### Icônes : **bootstrap-icons uniquement** (jamais d'emoji)

```tsx
<i className="bi bi-plus-lg" aria-hidden="true" />
<i className="bi bi-trash" aria-hidden="true" />
```
Catalogue : https://icons.getbootstrap.com/

### Couleurs : **toujours les tokens CSS**, jamais de hex en dur

Définis dans `:root` de [index.css](../src/index.css), avec **dark mode auto** (`prefers-color-scheme`).

| Token | Usage |
|-------|-------|
| `--accent` `#6366f1` (indigo) | Couleur principale |
| `--accent-strong` | Survol / pressed |
| `--accent-bg` / `--accent-border` | Fonds/bordures teintés accent |
| `--bg` / `--bg-subtle` / `--bg-sunken` | Surfaces (carte / page / creux) |
| `--text-h` / `--text` / `--text-muted` | Texte fort / secondaire / tertiaire |
| `--border` / `--border-strong` | Bordures |
| `--shadow-sm` / `--shadow` / `--shadow-lg` | Ombres |

```css
.ma-carte {
  background: var(--bg);
  color: var(--text-h);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
```

### Classes de boutons existantes

- `btn-primary` — action principale (indigo)
- `btn-ghost` — action secondaire (transparent)

### Langue

UI en **français**. Attention au piège connu : la **traduction automatique du navigateur** peut faire planter React (page blanche) en réécrivant le DOM — voir mémoire `glpinewapp-translation-react-crash`.

---

## 9. TypeScript — rappels utiles

```ts
// Type union de littéraux
type Status = 'idle' | 'loading' | 'success' | 'error'

// Dériver un type d'un tableau const
const TYPES = ['Computer', 'Monitor'] as const
type ItemType = (typeof TYPES)[number]   // 'Computer' | 'Monitor'

// Record (dictionnaire typé)
const ENDPOINTS: Record<ItemType, string> = { Computer: '/x', Monitor: '/y' }

// import type (pour ne pas embarquer de runtime)
import type { Session } from './services/types'

// Props d'un composant
function Carte({ title, onClose }: { title: string; onClose: () => void }) { … }
```

- Mets les types partagés dans [services/types.ts](../src/services/types.ts).
- Préfixe les variables d'env par `VITE_` pour qu'elles soient exposées au client.

---

## 10. Section back-office data-driven

Le back-office est **piloté par la donnée** : pour ajouter un onglet, tu décris une `Section` dans [sections.ts](../src/sections.ts), pas besoin d'écrire du JSX de table.

```ts
const MA_SECTION: Section = {
  id: 'ma-section',
  label: 'Mon libellé',
  icon: 'bi bi-box',
  endpoint: '/MonItemType',     // endpoint GLPI
  group: 'Inventaire',          // groupe dans la sidebar
  columns: [
    { key: 'name', label: 'Nom' },
    { key: 'date', label: 'Date', accessor: (row) => formatDate(row.date) },
  ],
}
```

Pour une section sans table (UI custom) : champ `custom: 'stats' | 'import' | …`.

---

## 11. Checklist avant de pousser une feature

- [ ] `npm run build` passe (types OK)
- [ ] `npm run lint` propre
- [ ] Aucun `fetch` brut dans un `.tsx` (→ déplacé dans un service)
- [ ] Couleurs via tokens, icônes via `bi bi-*` (zéro emoji, zéro hex en dur)
- [ ] Modales : fermeture clic-extérieur + Échap + focus auto
- [ ] `useEffect` avec cleanup (`active`) pour tout fetch
- [ ] Rien de modifié hors `GLPI_NewApp/`

---

## 12. Pour aller plus loin

- Exemple de formulaire complet : [CreateTicketPanel.tsx](../src/components/front/CreateTicketPanel.tsx)
- Exemple de modales (saisie + fiche détail) : [KanbanBoard.tsx](../src/components/front/KanbanBoard.tsx)
- Plomberie OAuth : [apiClient.ts](../src/services/apiClient.ts) / [frontSession.ts](../src/services/frontSession.ts)
- Config d'env : [.env.example](../.env.example)
