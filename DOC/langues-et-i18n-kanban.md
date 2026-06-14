# Langues & libellés multilingues du Kanban

Ce document décrit **tout ce qui concerne les langues** dans GLPI_NewApp : le référentiel de langues stocké en **SQLite**, les libellés de colonnes Kanban traduits par langue, l'API qui les expose, et la façon dont le front les consomme (sélecteur de langue sur `/kanban`, gestion en back-office).

> ⚠️ Il ne s'agit **pas** de l'internationalisation de l'interface (textes React, qui sont en dur en français). Ici, « langue » = **langue des libellés de colonnes du Kanban** (ex. afficher « Vaovao » au lieu de « Nouveau »).

---

## 1. Vue d'ensemble

Le Kanban a 3 colonnes (`NEW`, `IN_PROGRESS`, `DONE`). Chaque colonne peut avoir **un libellé différent par langue**. Les langues et leurs libellés vivent dans la **base SQLite du backend Spring Boot**, pas dans GLPI.

```
languages ──< kanban_status_labels >── kanban_statuses
   (langue)        (libellé localisé)        (colonne)
```

Un libellé est l'**intersection** d'un statut et d'une langue : « statut NEW en langue mg = Vaovao ».

---

## 2. Modèle de données SQLite

Défini dans [`schema.sql`](../newapp/src/main/resources/schema.sql), peuplé par [`data.sql`](../newapp/src/main/resources/data.sql).

### Table `languages` — référentiel des langues

| Colonne | Type | Rôle |
|---|---|---|
| `id` | INTEGER PK | Identifiant |
| `code` | TEXT **UNIQUE** | Code court (`mg`, `fr`, `en`…) |
| `name` | TEXT | Nom affiché (`Malagasy`, `Français`…) |
| `is_active` | INTEGER (0/1) | Langue active ou masquée |
| `created_at` | DATETIME | Date de création |

> C'est **ici** que se trouvent « les versions de langues » : chaque ligne = une langue disponible. La seule langue livrée par défaut est **Malagasy (`mg`)** :
> ```sql
> INSERT OR IGNORE INTO languages (id, code, name, is_active) VALUES (1, 'mg', 'Malagasy', 1);
> ```
> Pour ajouter une langue (ex. Français), il suffit d'insérer une ligne ou de passer par l'API `POST /languages`.

### Table `kanban_status_labels` — libellés traduits

| Colonne | Type | Rôle |
|---|---|---|
| `id` | INTEGER PK | Identifiant |
| `status_id` | FK → `kanban_statuses` | Quelle colonne |
| `language_id` | FK → `languages` | Quelle langue |
| `label` | TEXT | Le libellé traduit |
| `created_at` / `created_by` | | Traçabilité |

Contraintes clés :
- `UNIQUE (status_id, language_id)` → **un seul libellé** par couple (statut, langue).
- `ON DELETE CASCADE` sur les deux FK → supprimer une langue supprime automatiquement ses libellés.

Libellés Malagasy livrés par défaut (`data.sql`) :

| status_id | Colonne | Libellé `mg` |
|---|---|---|
| 1 | NEW | Vaovao |
| 2 | IN_PROGRESS | Efa manao |
| 3 | DONE | Vita |

### Tables liées (contexte)

- `kanban_statuses` — les 3 colonnes (`NEW`/`IN_PROGRESS`/`DONE`), avec `sort_order`.
- `kanban_status_colors` — couleur de fond par statut (indépendante de la langue).

---

## 3. Côté backend (Spring Boot)

| Entité | Fichier |
|---|---|
| `Language` | [`model/Language.java`](../newapp/src/main/java/com/glpi/newapp/model/Language.java) |
| `KanbanStatusLabel` | [`model/KanbanStatusLabel.java`](../newapp/src/main/java/com/glpi/newapp/model/KanbanStatusLabel.java) |

`KanbanStatusLabel` est lié par `@ManyToOne` à la fois à `KanbanStatus` et à `Language` (chargement `EAGER`), d'où la forme JSON imbriquée `{ status: { id }, language: { id }, label }`.

### Endpoints REST des langues

`LanguageController` ([`controller/LanguageController.java`](../newapp/src/main/java/com/glpi/newapp/controller/LanguageController.java)) — CRUD complet sur `/api/languages` :

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/languages` | Lister toutes les langues |
| GET | `/api/languages/{id}` | Une langue |
| POST | `/api/languages` | Créer une langue |
| PUT | `/api/languages/{id}` | Modifier |
| DELETE | `/api/languages/{id}` | Supprimer (cascade sur les libellés) |

Endpoints des libellés (`KanbanStatusLabelController`), notamment :
- `GET /api/kanban-status-labels` — tous les libellés
- `GET /api/kanban-status-labels/by-status/{statusId}` — libellés d'un statut (toutes langues)
- `POST` / `PUT /{id}` — créer / mettre à jour un libellé

> Le front appelle ces routes via le préfixe **`/kanban-api`** (proxy Vite → backend Spring Boot). Donc `/kanban-api/languages` ↔ `/api/languages`.

---

## 4. Côté front — service `kanbanConfigApi.ts`

Fichier : [`src/services/kanbanConfigApi.ts`](../src/services/kanbanConfigApi.ts).

### Types

```ts
interface Language { id: number; code: string; name: string; isActive: number }
interface KanbanStatusLabel {
  id: number
  status: { id: number }
  language: { id: number }
  label: string
}
```

### Fonctions liées aux langues

| Fonction | Rôle |
|---|---|
| `chargerLangues()` | `GET /languages`, **ne garde que** `isActive !== 0`. Alimente le sélecteur du Kanban front. |
| `chargerConfigKanban(langId)` | Pour la langue choisie, récupère le **libellé localisé** de chaque colonne (+ sa couleur). Si `langId === null` → pas de libellé (titres FR par défaut). |
| `chargerConfigurationAdminKanban()` | Charge tout (statuts, langues actives, couleurs, libellés) pour le back-office. Langue par défaut = **`mg`** sinon la première. |
| `enregistrerConfigurationAdminKanban(config)` | Crée/met à jour couleurs et libellés (POST si nouveau, PUT si `labelId` existe). Les libellés **vides sont ignorés**. |

Détail de `chargerConfigKanban` — choix du libellé pour la langue demandée :

```ts
const label = langId !== null
  ? labels.sort((a, b) => a.id - b.id)
      .find((item) => item.language?.id === langId)?.label ?? null
  : null
```

---

## 5. Côté front — où la langue est utilisée

### a) Sélecteur de langue sur `/kanban`

Dans [`KanbanBoard.tsx`](../src/components/front/KanbanBoard.tsx) :

```ts
const [languages, setLanguages] = useState<Language[]>([])
const [selectedLangId, setSelectedLangId] = useState<number | null>(null)

useEffect(() => { chargerLangues().then(setLanguages) }, [])
useEffect(() => { chargerConfigKanban(selectedLangId).then(setColConfigs) }, [selectedLangId])
```

- Un `<select>` (option **« Défaut »** = `null`, puis une option par langue active) est affiché si au moins une langue existe.
- Changer la langue recharge `colConfigs`, et chaque colonne affiche `colConfigs[col.id]?.label ?? titre` :
  - **Défaut** → titres français en dur (`Nouveau` / `In progress` / `Terminé`).
  - **Langue choisie** → libellé traduit (ex. `Vaovao`), avec le titre FR en sous-titre.

### b) Gestion en back-office — `KanbanConfigPanel.tsx`

Dans [`KanbanConfigPanel.tsx`](../src/components/KanbanConfigPanel.tsx) (back-office `/admin`), pour chaque colonne :

- un sélecteur **« Langue du libellé »** (liste des langues actives) ;
- un champ **« Nom du statut en <langue> »** qui édite le libellé de la langue sélectionnée ;
- une couleur de fond (indépendante de la langue).

Règles de validation à l'enregistrement :
- les 3 statuts actifs sont requis ;
- chaque couleur doit être un hex `#rrggbb` ;
- **chaque statut doit avoir un nom non vide dans la langue sélectionnée**.

---

## 6. Cycle de vie d'un libellé traduit

```
1. (Optionnel) Créer une langue      → POST /languages           → ligne dans `languages`
2. Back-office : choisir la langue, saisir le nom de chaque colonne
3. Enregistrer                        → POST/PUT kanban-status-labels → lignes dans `kanban_status_labels`
4. Front /kanban : choisir la langue dans le sélecteur
5. chargerConfigKanban(langId)        → les colonnes affichent les libellés traduits
```

---

## 7. Ajouter une nouvelle langue (ex. Français)

1. Insérer la langue, par SQL :
   ```sql
   INSERT OR IGNORE INTO languages (code, name, is_active) VALUES ('fr', 'Français', 1);
   ```
   ou via l'API : `POST /kanban-api/languages` avec `{ "code": "fr", "name": "Français", "isActive": 1 }`.
2. Aller dans le back-office Kanban, sélectionner **Français** sur chaque colonne et saisir les libellés.
3. Enregistrer → les libellés FR apparaissent dans le sélecteur de `/kanban`.

> Masquer une langue sans perdre ses libellés : passer `is_active = 0` (elle disparaît des sélecteurs car `chargerLangues()` filtre les inactives). La **supprimer** efface aussi ses libellés (cascade).

---

## 8. Récapitulatif des éléments « langue »

| Couche | Élément | Rôle |
|---|---|---|
| SQLite | `languages` | Référentiel des langues (les « versions de langues ») |
| SQLite | `kanban_status_labels` | Libellé d'une colonne pour une langue |
| Backend | `LanguageController` (`/api/languages`) | CRUD des langues |
| Backend | `KanbanStatusLabelController` | CRUD des libellés traduits |
| Front service | `chargerLangues`, `chargerConfigKanban` | Lecture langues + libellés (Kanban front) |
| Front service | `charger/enregistrerConfigurationAdminKanban` | Édition (back-office) |
| Front UI | `KanbanBoard.tsx` | Sélecteur de langue sur `/kanban` |
| Front UI | `KanbanConfigPanel.tsx` | Édition des libellés par langue (`/admin`) |

---

Voir aussi : [`calcul-tableau-couts-materiels.md`](./calcul-tableau-couts-materiels.md) et [`reouverture-et-annulation.md`](./reouverture-et-annulation.md).
