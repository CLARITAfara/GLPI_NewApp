# GLPI_NewApp — Documentation des fonctionnalités

> Portée : **réinitialisation de données**, **import de fichiers**, **utilisation de SQLite**, et **échange JSON avec l'API**.
> Cette doc décrit l'**état réellement implémenté** dans le code, et signale les **écarts avec le `README.md`** (qui décrit une cible avec un backend Express non présent dans le dépôt).

## 0. Architecture en bref

| Couche | Rôle | Où |
|---|---|---|
| Frontend React (Vite + TS) | Toute l'UI et la logique métier | `src/` |
| API REST GLPI « High-Level » (OAuth) | Lecture/écriture des données GLPI (MySQL) | proxy Vite `/api` → `…/api.php` |
| API REST GLPI « legacy » (`/api/v1`, user_token) | Upload de fichiers + relations `Item_Ticket` | `src/services/legacyApi.ts` |
| Backend Express + SQLite | **Décrit dans le README, absent du dépôt** | `server/` (manquant) |

Point clé : **toute l'application en service dialogue avec GLPI (MySQL) via l'API REST**. La partie SQLite/Express est de l'outillage (scaffolding) **pas encore branché** dans l'app React.

---

## 1. Réinitialisation de données

### 1.1 Où
- UI : [`src/components/ResetPanel.tsx`](../src/components/ResetPanel.tsx), section **« Réinitialisation »** du tableau de bord (réservée aux profils admin : `Super-Admin`, `Admin`, `Supervisor`).
- Logique : [`src/services/resetApi.ts`](../src/services/resetApi.ts), appuyée sur [`src/services/glpiApi.ts`](../src/services/glpiApi.ts).

### 1.2 Modules réinitialisables (`MODULES_RESET`)
Chaque module cible un ou plusieurs endpoints GLPI :

| Module | Endpoint GLPI | Particularité |
|---|---|---|
| 🎫 Tickets | `/Assistance/Ticket` | |
| 💻 Ordinateurs | `/Assets/Computer` | |
| 🖥️ Moniteurs | `/Assets/Monitor` | |
| 👤 Utilisateurs | `/Administration/User` | **exclut** les comptes protégés |
| 📍 Localisations | `/Dropdowns/Location` | dropdown : pas de corbeille |
| 🏷️ Statuts | `/Dropdowns/State` | dropdown : pas de corbeille |
| 🏭 Fabricants | `/Dropdowns/Manufacturer` | dropdown : pas de corbeille |

**Comptes jamais supprimés** (`UTILISATEURS_PROTEGES`) : `glpi`, `glpi-system`, `post-only`, `tech`, `normal` (comparaison sur `username`, en minuscules).

### 1.3 Déroulé (4 phases dans l'UI)
1. **Sélection** — cases à cocher par module ; le compteur « N en base » provient de `compterEndpoints()` (lit l'en-tête HTTP `Content-Range`).
2. **Confirmation** — il faut taper littéralement `RESET` pour activer le bouton.
3. **Exécution** — pour chaque module : collecte paginée des IDs (500/page) puis `DELETE` un par un, avec barre de progression.
4. **Rapport** — total supprimé + détail des échecs par endpoint.

### 1.4 Suppression (`supprimerItem`)
- `DELETE {endpoint}/{id}` via l'API OAuth.
- **Soft delete** : l'élément part dans la **corbeille GLPI** (sauf dropdowns, sans corbeille).
- `404` traité comme succès (déjà supprimé).
- Les dropdowns (`sansCorbeille: true`) n'ont pas de champ `is_deleted` → on n'applique pas le filtre `is_deleted==false` (sinon erreur RSQL).
- **Robustesse** : `reinitialiser()` ne lève jamais d'exception ; chaque échec (listing ou suppression) est consigné dans le rapport.

### 1.5 ⚠️ Écart avec le README
Le `README.md` décrit une réinitialisation **au niveau MySQL** (`mysqldump` de sauvegarde puis `TRUNCATE`) pilotée par [`DB/modules.json`](../DB/modules.json), via un backend Express. **Ce n'est pas ce que fait l'app** : l'implémentation réelle supprime **enregistrement par enregistrement via l'API REST GLPI** (soft delete). `DB/modules.json` et les scripts `DB/*.ps1` ne sont pas utilisés par le panneau de réinitialisation de l'app.

---

## 2. Import de fichiers

### 2.1 Où
- UI : [`src/components/ImportPanel.tsx`](../src/components/ImportPanel.tsx), section **« Import CSV »** (admin).
- Validation : [`src/services/importValidation.ts`](../src/services/importValidation.ts) + schémas [`src/services/importSchemas.ts`](../src/services/importSchemas.ts).
- Parsing CSV : [`src/services/csvUtil.ts`](../src/services/csvUtil.ts).
- Exécution : [`src/services/importApi.ts`](../src/services/importApi.ts).
- Données d'exemple : [`data-import/`](../data-import/) (3 CSV + `images.zip`).

### 2.2 Fichiers attendus
**Les 3 fichiers CSV sont obligatoires** (le bouton « Valider et importer » reste désactivé tant qu'ils ne sont pas tous fournis). Le ZIP d'images est optionnel.

| Fichier | Contenu | Colonnes |
|---|---|---|
| Feuille 1 — Inventaire (`.csv`) | Ordinateurs & moniteurs | `Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User` |
| Feuille 2 — Tickets (`.csv`) | Tickets + objets liés | `Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items` |
| Feuille 3 — Coûts (`.csv`) | Coûts par ticket | `Num_Ticket, Duration_second, Time_Cost, Fixed_Cost` |
| Images (`.zip`) | Optionnel | nom de fichier (sans extension) = `Name` de l'asset |

**Cohérence inter-feuilles vérifiée à la validation :**
- chaque valeur de `Items` (Feuille 2) doit correspondre à un `Name` de la **Feuille 1** ;
- chaque `Num_Ticket` (Feuille 3) doit correspondre à un `Ref_Ticket` de la **Feuille 2** ;
- les doublons de `Name` (Feuille 1) et de `Ref_Ticket` (Feuille 2) sont rejetés.

### 2.3 Règles de validation par colonne (`RegleType`)
`texte` (requis), `texte-optionnel`, `entier` (≥0), `nombre-fr` (décimal, virgule FR), `date-ddmmyyyy` (`JJ/MM/AAAA`), `heure-hhmm` (`HH:MM`), `enum` (table de correspondance insensible à la casse), `json-array` (ex. `["PC-ADM-001"]`).
Les `enum` mappent les libellés vers les **codes GLPI** (ex. `Type` ticket : incident→1, demande→2 ; `Status`, `Priority`, `Item_Type`…).

### 2.4 Parsing CSV (`analyserCsv`)
Parseur maison, sans dépendance : gère les guillemets, virgules et **sauts de ligne à l'intérieur d'un champ**, les guillemets échappés (`""`), ignore les lignes vides, et **conserve le n° de ligne d'origine** pour le rapport d'erreurs.

### 2.5 ZIP d'images (sans bibliothèque)
- Lecture du « central directory » du ZIP pour lister les entrées.
- Décompression via `DecompressionStream('deflate-raw')` (API navigateur).
- **Détection du vrai type d'image par magic bytes** (PNG/JPEG/GIF/WebP/BMP) : indispensable car GLPI **refuse** un fichier dont le contenu ne correspond pas à l'extension.

### 2.6 Validation puis exécution
La validation a lieu **avant tout appel d'écriture**. En cas d'erreur → écran « Erreurs » détaillé (fichier, ligne, colonne, valeur, message), aucun appel API. Sinon → **aperçu** : compte des assets/tickets/coûts et, via `detecterAssetsExistants()`, indication des matériels **déjà présents dans GLPI** (même nom + type) qui seront **réutilisés** au lieu d'être recréés. Puis **confirmation** → exécution.

`importer()` procède en **5 étapes** avec **rollback atomique** (toute création est empilée et annulée en ordre inverse si une étape échoue) :
1. **Matériel** — résout/crée les dropdowns (Status, Location, Manufacturer, Model) et l'utilisateur (`find-or-create`), puis crée l'asset. **Dédoublonnage** : un asset déjà présent (même nom + type) est réutilisé, pas recréé.
2. **Images → documents** liés (API legacy, best-effort, non bloquant).
3. **Tickets**.
4. **Coûts** des tickets.
5. **Liens matériel ↔ ticket** (relation `Item_Ticket`, API legacy, best-effort).

### 2.7 Dépendance au jeton legacy
Les **images** et les **liens `Item_Ticket`** passent par l'API REST legacy et nécessitent `VITE_GLPI_USER_TOKEN` (l'API OAuth High-Level n'expose pas l'upload de fichiers ni la création de `Item_Ticket`). Sans jeton, ces deux volets sont ignorés (avertissement), le reste de l'import se fait.

---

## 3. Utilisation de SQLite

### 3.1 Fichier et finalité
- Base : [`DB/glpi.sqlite`](../DB/glpi.sqlite) — destinée à des **tables « custom »**, distinctes de la base **MySQL** de GLPI.
- Éditée via l'extension **SQLite (alexcvzz)** de VS Code (cf. README).

### 3.2 Backend auto-CRUD (décrit dans le README)
D'après le README, un serveur **Node.js/Express** (`server/`) sur **http://localhost:3001** :
- détecte automatiquement toutes les tables du fichier SQLite au démarrage ;
- génère les routes CRUD : `GET/POST /api/:table`, `GET/PUT/DELETE /api/:table/:id`, et `GET /api` (liste des tables).

Le frontend pointe vers ce serveur via `config.localApiUrl` (`VITE_LOCAL_API_URL`, défaut `http://localhost:3001/api`) et l'helper `fetchLocale()` ([`src/services/apiClient.ts`](../src/services/apiClient.ts)).

### 3.3 Réinitialisation de la base SQLite
- [`DB/reset.js`](../DB/reset.js) (module ESM, dépend de `better-sqlite3`) :
  1. **sauvegarde** `glpi.sqlite` dans `DB/backups/` (horodatée) ;
  2. **vide** toutes les tables utilisateur + remet les `sqlite_sequence` à zéro ;
  3. **réinsère** les données essentielles depuis `DB/seed.sql` (s'il existe).
- [`DB/reset-glpi.ps1`](../DB/reset-glpi.ps1) : wrapper PowerShell (`powershell -File DB/reset-glpi.ps1`).

### 3.4 ⚠️ État réel
- Le dossier **`server/` est absent** du dépôt : l'API SQLite locale n'est pas fournie ici.
- **Aucun service du frontend en service n'appelle `fetchLocale()`** : toutes les fonctionnalités actives (import, reset, tickets, éléments, stats) passent par l'**API REST GLPI (MySQL)**, pas par SQLite.
- `DB/reset.js` référence `seed.sql`, **non présent** → le reset SQLite laisserait la base vide.
- En résumé : **SQLite = brique préparée mais non encore intégrée** au fonctionnement de l'app React.

---

## 4. Échange de données au format JSON

Tous les échanges applicatifs se font en **JSON**.

### 4.1 API OAuth High-Level ([`apiClient.ts`](../src/services/apiClient.ts))
- `apiFetch()` ajoute systématiquement `Accept: application/json`, `Authorization: Bearer <token>`, et `Content-Type: application/json` sur les écritures ; les corps sont `JSON.stringify(...)` et les réponses lues via `res.json()`.
- **Authentification OAuth** : `POST /token` avec un **corps JSON** (`grant_type: password` au login, `refresh_token` au rafraîchissement). Sur `401`, `apiFetch` tente un refresh puis rejoue la requête.
- **Listes** : tableaux JSON d'objets ; le **total** est lu dans l'en-tête `Content-Range` (`"0-19/42"` → 42) ; filtres en **RSQL** (`is_deleted==false`, `;` = ET).
- Tokens stockés côté client en JSON (`tokenStore.ts`).

### 4.2 API REST legacy ([`legacyApi.ts`](../src/services/legacyApi.ts))
- Session ouverte via `GET /initSession` (en-tête `Authorization: user_token …`) → `session_token`.
- Corps JSON encapsulés dans une enveloppe **`{ "input": { … } }`** (création de `Item_Ticket`, documents…).
- **Exception au JSON** : l'upload de fichier (`POST /Document`) utilise `multipart/form-data` = un manifeste **JSON** (`uploadManifest`) + le binaire du fichier.

### 4.3 API locale SQLite (README)
CRUD entièrement JSON (corps JSON en POST/PUT, réponses JSON). Voir §3.

### 4.4 Spécification
[`API/doc.json`](../API/doc.json) contient la spec **OpenAPI 3.0** de l'API GLPI High-Level (générée par GLPI).

---

## Annexe — Écarts README ↔ implémentation (à connaître)

| Sujet | README (cible) | Implémentation réelle |
|---|---|---|
| Backend `server/` Express + SQLite | Présent, port 3001, CRUD auto | **Absent** du dépôt |
| Reset | `mysqldump` + `TRUNCATE` MySQL via `DB/modules.json` | **API REST GLPI**, soft delete par enregistrement |
| SQLite dans l'app | Source de données via `fetchLocale` | **Non appelé** par les services actifs |
| `seed.sql` (reset SQLite) | Réinsère l'essentiel | **Fichier absent** |
