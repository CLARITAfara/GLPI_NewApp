# AGENTS.md — Guide de développement pour agent IA

> Ce document est destiné à un agent IA chargé de développer ou maintenir le projet GLPI_NewApp.
> Il décrit le projet, ses conventions, ses règles et les processus à suivre impérativement.

---

## 1. Description du projet

**GLPI_NewApp** est une application web full-stack de gestion de parc informatique et de helpdesk.
Elle se connecte à une instance GLPI existante via son API OAuth et REST legacy, et ajoute :

- Un **back-office admin** (tableau de bord, tickets, inventaire, import CSV, réinitialisation)
- Un **front-office public** (navigation d'assets, Kanban de tickets, création rapide de tickets)
- Un **microservice Spring Boot** local pour la configuration du tableau Kanban (statuts, couleurs, libellés multilingues)

L'objectif est d'offrir une interface moderne et simplifiée par-dessus l'interface GLPI native.

---

## 2. Technologies utilisées

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| React | 19.2.6 | Framework UI |
| React Router DOM | 7.17.0 | Routing SPA |
| TypeScript | 6.0.2 | Typage statique |
| Vite | 8.0.12 | Bundler + dev server |
| Bootstrap Icons | 1.13.1 | Pictogrammes |
| ESLint + typescript-eslint | — | Linting |

### Backend (microservice)
| Technologie | Version | Rôle |
|---|---|---|
| Java | 17 | Langage |
| Spring Boot | 4.0.6 | Framework REST |
| Spring Data JPA | — | ORM |
| Hibernate | — | Implémentation JPA |
| SQLite JDBC | 3.50.1.0 | Base de données locale |
| Lombok | — | Réduction de boilerplate |
| Maven | — | Build |

### Infrastructure
- **GLPI** : instance tierce, requiert OAuth 2.0 (password grant) + API REST legacy
- **SQLite** : fichier `newapp/newapp.db`, géré par schema.sql + data.sql
- **Proxy Vite** : redirige `/api` → GLPI, `/kanban-api` → Spring Boot local

---

## 3. Structure des dossiers

```
GLPI_NewApp/
├── src/                          # Frontend React/TypeScript
│   ├── App.tsx                   # Router principal + garde d'auth
│   ├── config.ts                 # Variables d'environnement centralisées
│   ├── format.ts                 # Utilitaires de formatage (dates)
│   ├── sections.ts               # Définitions des sections back-office
│   ├── context/
│   │   ├── AuthContext.tsx       # Hook useAuth()
│   │   └── AuthProvider.tsx      # État global d'authentification
│   ├── pages/
│   │   ├── LoginPage.tsx         # Page login admin
│   │   ├── DashboardPage.tsx     # Page dashboard admin
│   │   └── FrontPage.tsx         # Page front-office (non utilisée comme route directe)
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   ├── Dashboard.tsx         # Shell admin (sidebar + outlet)
│   │   ├── Sidebar.tsx           # Navigation latérale
│   │   ├── Breadcrumb.tsx
│   │   ├── SectionView.tsx       # Rendu générique d'une section
│   │   ├── TicketsView.tsx       # Liste tickets admin
│   │   ├── TicketList.tsx        # Tableau de tickets
│   │   ├── StatsView.tsx         # Statistiques dashboard
│   │   ├── ImportPanel.tsx       # Interface import CSV
│   │   ├── ResetPanel.tsx        # Interface réinitialisation
│   │   ├── KanbanConfigPanel.tsx # Configuration Kanban (admin)
│   │   └── front/                # Composants front-office
│   │       ├── FrontAutoLogin.tsx     # Connexion automatique (outlet parent)
│   │       ├── FrontLayout.tsx        # Layout front-office
│   │       ├── FrontDashboard.tsx     # Accueil front-office
│   │       ├── ElementsPanel.tsx      # Navigation d'assets
│   │       ├── ElementsTable.tsx      # Tableau d'assets
│   │       ├── ElementsFilters.tsx    # Filtres assets
│   │       ├── ItemSelector.tsx       # Widget multi-sélection
│   │       ├── KanbanBoard.tsx        # Tableau Kanban (front)
│   │       └── CreateTicketPanel.tsx  # Création de ticket détaillée
│   └── services/                 # Couche réseau (tous les appels API)
│       ├── types.ts              # Types OAuth/session
│       ├── tokenStore.ts         # Persistance tokens localStorage
│       ├── apiClient.ts          # Client OAuth + refresh auto
│       ├── frontSession.ts       # Session auto-login front-office
│       ├── glpiApi.ts            # Helpers paginations GLPI
│       ├── legacyApi.ts          # API REST legacy /api/v1
│       ├── userApi.ts            # Endpoints utilisateurs
│       ├── computerApi.ts        # Endpoints ordinateurs
│       ├── elementsApi.ts        # Recherche multi-types d'assets
│       ├── ticketApi.ts          # CRUD tickets SQLite local
│       ├── ticketsApi.ts         # Tickets GLPI (admin)
│       ├── ticketCreateApi.ts    # Création ticket + matrice priorité
│       ├── ticketsFrontApi.ts    # Kanban front-office
│       ├── kanbanConfigApi.ts    # API Kanban config (Spring Boot)
│       ├── csvUtil.ts            # Parsing/sérialisation CSV (pur)
│       ├── importSchemas.ts      # Schémas CSV + registre des 19 types
│       ├── importValidation.ts   # Validation pré-import
│       ├── importApi.ts          # Pipeline import 6 étapes avec rollback
│       ├── resetApi.ts           # Réinitialisation sélective de modules
│       ├── statsApi.ts           # Agrégation de statistiques
│       └── concurrency.ts        # Pool d'exécution parallèle borné
│
├── newapp/                        # Backend Spring Boot (microservice)
│   ├── pom.xml
│   └── src/main/java/com/glpi/newapp/
│       ├── NewappApplication.java
│       ├── model/                 # Entités JPA
│       │   ├── Language.java
│       │   ├── KanbanStatus.java
│       │   ├── KanbanStatusColor.java
│       │   └── KanbanStatusLabel.java
│       ├── repository/            # Spring Data JPA
│       │   ├── LanguageRepository.java
│       │   ├── KanbanStatusRepository.java
│       │   ├── KanbanStatusColorRepository.java
│       │   └── KanbanStatusLabelRepository.java
│       ├── service/               # Logique métier
│       │   ├── LanguageService.java
│       │   ├── KanbanStatusService.java
│       │   ├── KanbanStatusColorService.java
│       │   └── KanbanStatusLabelService.java
│       └── controller/            # Contrôleurs REST
│           ├── LanguageController.java
│           ├── KanbanStatusController.java
│           ├── KanbanStatusColorController.java
│           └── KanbanStatusLabelController.java
│   └── src/main/resources/
│       ├── application.properties # Config Spring Boot / SQLite
│       ├── schema.sql             # DDL (CREATE TABLE IF NOT EXISTS)
│       └── data.sql               # Données initiales idempotentes
│
├── DB/                            # Sauvegardes et définitions de modules
│   ├── seed.sql
│   ├── modules.json               # Définitions des modules pour le reset
│   └── backups/
├── API/
│   └── doc.json                   # Documentation OpenAPI GLPI
├── .env                           # Variables d'environnement (ne pas committer)
├── .env.example                   # Template .env
├── vite.config.ts                 # Proxy dev + plugins
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js
├── package.json
└── index.html
```

---

## 4. Conventions de nommage

### TypeScript / React
- **Composants React** : `PascalCase` (ex. `KanbanBoard.tsx`, `CreateTicketPanel.tsx`)
- **Hooks** : `useXxx` (ex. `useAuth`)
- **Fichiers de services** : `camelCase` (ex. `apiClient.ts`, `importSchemas.ts`)
- **Types/Interfaces** : `PascalCase` (ex. `GlpiRow`, `ItemTypeConfig`)
- **Constantes globales** : `UPPER_SNAKE_CASE` (ex. `ITEM_TYPES`, `ADMIN_PROFILES`)
- **Fonctions utilitaires** : `camelCase` (ex. `normaliser`, `formatDate`)
- **Variables locales** : `camelCase`
- **Enums/codes GLPI** : constantes numériques ou `Record<string, number>`

### Java / Spring Boot
- **Classes** : `PascalCase` (ex. `KanbanStatusColorService`)
- **Méthodes** : `camelCase`
- **Variables** : `camelCase`
- **Tables SQL** : `snake_case` (ex. `kanban_status_colors`)
- **Colonnes SQL** : `snake_case` (ex. `background_color`, `created_at`)
- **Champs entité** : `camelCase` (Lombok + JPA s'en chargent)

### Fichiers SQL
- Tables : `snake_case` pluriel (ex. `kanban_statuses`, `languages`)
- Colonnes FK : `entite_id` (ex. `status_id`, `language_id`)

---

## 5. Architecture frontend/backend

### Frontend (React SPA)

**Deux interfaces distinctes dans la même SPA :**

1. **Back-office admin** (`/login`, `/admin`, `/admin/:section`)
   - Authentification OAuth manuelle (formulaire de login)
   - Accessible uniquement aux profils `Super-Admin`, `Admin`, `Supervisor`
   - Sections : Stats, Tickets, Kanban config, Ordinateurs, Utilisateurs, Import, Reset
   - `App.tsx` : redirige vers `/login` si non authentifié, vers `/` si non admin

2. **Front-office public** (`/`, `/kanban`, `/tickets/create`)
   - Connexion automatique via `FrontAutoLogin.tsx` (credentials depuis `config.ts`)
   - Session séparée de l'admin (tokens distincts dans `frontSession.ts`)
   - Accessible à tous sans interaction
   - Affiche assets, Kanban, formulaire de création de ticket

**Couche de services (`src/services/`) :**
- Tous les appels réseau passent par les fichiers `*Api.ts`
- Jamais d'`fetch` direct dans les composants ou pages
- `apiClient.ts` : client central OAuth avec refresh automatique sur 401
- `frontSession.ts` : client pour la session front (même mécanique, credentials différents)

### Backend (Spring Boot)

Architecture en 4 couches :
```
Controller → Service → Repository → SQLite (via JPA/Hibernate)
```

- Les **contrôleurs** reçoivent les requêtes HTTP, délèguent aux services
- Les **services** contiennent la logique métier (upsert, validation)
- Les **repositories** sont des interfaces `JpaRepository<Entity, Long>` (Spring Data)
- Le **schéma SQL** est géré manuellement par `schema.sql` (`ddl-auto=none`)

---

## 6. Règles de développement

### Règles absolues
1. **Ne jamais appeler `fetch` directement dans un composant** — passer par un service `*Api.ts`.
2. **Ne jamais modifier `schema.sql` sans ajouter une migration compatible** — `CREATE TABLE IF NOT EXISTS`, jamais `DROP TABLE`.
3. **`data.sql` doit rester idempotent** — utiliser `INSERT OR IGNORE`, jamais `INSERT` nu.
4. **Les types GLPI (`ITEM_TYPES`) sont la source de vérité unique** — toute logique dépendante du type (endpoint, champs, icône) doit lire ce registre.
5. **Les sections back-office (`sections.ts`) sont la source de vérité pour la navigation** — `sectionsForRole()` détermine l'accès selon le profil.
6. **Le rollback import est LIFO** — toute nouvelle étape d'import doit ajouter ses opérations de nettoyage au stack avant d'exécuter.
7. **Bounded concurrency** — utiliser `concurrency.ts` pour tout traitement parallèle massif ; ne jamais lancer >10 requêtes GLPI simultanément.

### Règles TypeScript
- Activer `strict: true` — ne pas contourner avec `as any` sauf cas documenté
- Utiliser les types existants (`GlpiRow`, `ItemType`, etc.) plutôt que de re-déclarer
- Les enums GLPI (statuts, types, priorités) sont des `Record<string, number>` dans `importSchemas.ts`
- Typer explicitement les retours de fonctions API

### Règles Java/Spring
- Utiliser Lombok (`@Data`, `@NoArgsConstructor`, etc.) — ne pas écrire de getters/setters manuels
- Les entités JPA ont des annotations `@Column` avec contraintes (`nullable`, `unique`)
- Upsert pattern : vérifier l'existence avant création (cf. `KanbanStatusColorService`)
- CORS doit être configuré si le front accède au backend depuis un port différent

### Règles CSS/Style
- Bootstrap Icons uniquement (classes `bi bi-xxx`)
- Pas de library CSS externe supplémentaire sans discussion préalable
- Styles globaux dans `App.css`

---

## 7. Variables d'environnement

Toutes les variables sont préfixées `VITE_` et lues centralement dans `src/config.ts`.

| Variable | Description | Obligatoire |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL de l'API GLPI (défaut `/api`) | Non |
| `VITE_API_PROXY_TARGET` | URL GLPI pour le proxy dev (ex. `https://localhost/glpi/public`) | Dev |
| `VITE_OAUTH_CLIENT_ID` | Client ID OAuth GLPI | Oui |
| `VITE_OAUTH_CLIENT_SECRET` | Client Secret OAuth GLPI | Oui |
| `VITE_OAUTH_SCOPES` | Scopes OAuth (défaut `api user email`) | Non |
| `VITE_GLPI_USER_TOKEN` | Jeton API personnel (upload images, API legacy) | Oui (import) |
| `VITE_GLPI_APP_TOKEN` | App-Token GLPI (optionnel) | Non |
| `VITE_GLPI_USERNAME` | Login auto front-office (défaut `glpi`) | Non |
| `VITE_GLPI_PASSWORD` | Mot de passe auto front-office (défaut `glpi`) | Non |

**Ne jamais committer le fichier `.env`.** Utiliser `.env.example` comme référence.

---

## 8. Proxy de développement (Vite)

Le fichier `vite.config.ts` définit deux proxys transparents :

| Chemin client | Destination | Transformation |
|---|---|---|
| `/api/...` | `VITE_API_PROXY_TARGET/api.php/...` | Remplace `/api` par `/api.php` |
| `/kanban-api/...` | `http://localhost:8080/api/...` | Remplace `/kanban-api` par `/api` |

En production, le vrai serveur doit assurer ces mêmes redirections.
Le Spring Boot écoute sur le port **8080** par défaut.

---

## 9. Workflow Git recommandé

```
main          # branche stable, déployable
├── Meme      # branche de développement principale (actuelle)
├── feature/xxx   # nouvelles fonctionnalités
└── fix/xxx       # corrections de bugs
```

### Avant toute modification
1. **Lire** les fichiers concernés — ne pas supposer leur contenu
2. **Identifier les dépendances** — chercher tous les endroits qui utilisent le symbole/fichier modifié
3. **Vérifier `sections.ts`** si la modification concerne la navigation ou les sections
4. **Vérifier `ITEM_TYPES`** si la modification concerne l'import ou les types GLPI
5. **Vérifier `importSchemas.ts`** si la modification concerne la validation CSV

### Processus avant chaque commit
1. Vérifier qu'aucun `console.log` de debug n'a été laissé
2. Vérifier que TypeScript compile sans erreur (`tsc --noEmit` ou build Vite)
3. Vérifier que les nouvelles constantes/fonctions sont exportées si utilisées ailleurs
4. S'assurer que `data.sql` reste idempotent après toute modification
5. Vérifier que les endpoints Spring Boot répondent correctement si modifiés
6. Ne **jamais** committer le fichier `.env`

---

## 10. Standards de qualité

### TypeScript
- Zéro `any` non documenté
- Toutes les fonctions API typent leur retour
- Les erreurs GLPI sont parsées (le corps JSON contient souvent `[code, message]`)
- Les composants React sont des fonctions (pas de classes)

### Spring Boot
- Chaque entité a des contraintes de validation (`@NotBlank`, `@NotNull`)
- Les services retournent des entités ou `Optional<T>`, jamais `null` brut
- `ddl-auto=none` — le schéma est géré uniquement par `schema.sql`

### Tests
- Backend : `NewappApplicationTests.java` (test de chargement du contexte Spring)
- Frontend : pas de tests automatisés détectés — tester manuellement les flux critiques

---

## 11. Gestion des erreurs

### Frontend
- **Erreurs GLPI** : le corps de réponse est souvent `[code_erreur, message]` — parser avec `response.json()`
- **401** : `apiClient.ts` tente automatiquement un refresh de token, puis déconnecte
- **Rollback import** : `importApi.ts` accumule les callbacks de nettoyage dans un stack LIFO ; sur toute exception, exécuter le stack en ordre inverse
- **Validation CSV** : retourner un tableau d'erreurs détaillées (fichier, ligne, colonne, valeur, message) — jamais une exception brute
- **Comptage via Content-Range** : l'API GLPI retourne `Content-Range: items 0-N/TOTAL` — gérer le cas 404 (0 résultats) gracieusement

### Backend
- Les contrôleurs Spring Boot retournent `ResponseEntity<T>` avec les codes HTTP appropriés
- Les services lancent des exceptions métier (pas de code de retour nul)
- SQLite : pas de connexions parallèles — Spring Data sérialise les accès

---

## 12. Bonnes pratiques de sécurité

1. **Ne jamais stocker de credentials GLPI dans le code** — utiliser `.env` uniquement
2. **Les tokens OAuth sont dans `localStorage`** — acceptable pour une app intranet, mais à surveiller
3. **Valider les CSV côté client avant envoi** — réduire les créations orphelines en cas d'erreur
4. **Les logins protégés** (`glpi`, `glpi-system`, `post-only`, `tech`, `normal`) ne sont pas supprimables par le reset — vérifier dans `resetApi.ts`
5. **Le front-office utilise un compte GLPI dédié** — `VITE_GLPI_USERNAME`/`VITE_GLPI_PASSWORD` — ne pas utiliser le compte admin
6. **CORS** : en développement, le proxy Vite évite les problèmes CORS ; en production, configurer le serveur web correctement
7. **`secure: false` dans vite.config.ts** est uniquement pour le dev avec certificat auto-signé — ne pas reproduire en prod

---

## 13. Processus à suivre avant toute modification

```
1. Lire les fichiers sources concernés (ne pas supposer)
2. Identifier tous les consommateurs du symbole/endpoint modifié (grep)
3. Vérifier les registres centraux (ITEM_TYPES, sections.ts, importSchemas.ts)
4. Planifier les changements (quels fichiers, dans quel ordre)
5. Vérifier l'impact sur le rollback si modification de importApi.ts
6. Tester le flux complet (pas seulement l'unité modifiée)
```

---

## 14. Checklist de validation

Avant de considérer une modification comme terminée :

- [ ] TypeScript compile sans erreur (`noEmit`)
- [ ] Le proxy Vite fonctionne (serveur dev accessible)
- [ ] Le Spring Boot démarre sans erreur (si backend modifié)
- [ ] Les endpoints modifiés répondent correctement (Postman / curl)
- [ ] Le flux d'authentification admin fonctionne (login → dashboard)
- [ ] La session front-office s'établit automatiquement
- [ ] Les imports CSV passent la validation sur les fichiers de test
- [ ] Le Kanban charge les statuts depuis Spring Boot
- [ ] Aucun `console.log` de debug laissé
- [ ] `.env` non inclus dans les fichiers staged
- [ ] `data.sql` reste idempotent (INSERT OR IGNORE)
- [ ] Aucun doublon dans les registres (`ITEM_TYPES`, `TYPES_ITEM`)

---

## 15. Points d'entrée clés à connaître

| Besoin | Fichier |
|---|---|
| Ajouter une section admin | `src/sections.ts` + `src/components/SectionView.tsx` |
| Ajouter un type d'asset importable | `src/services/importSchemas.ts` (`ITEM_TYPES` + `TYPES_ITEM`) |
| Modifier la navigation | `src/sections.ts` (`sectionsForRole`) |
| Ajouter un appel API GLPI | Créer ou modifier un fichier `src/services/*Api.ts` |
| Ajouter un statut Kanban | `newapp/src/main/resources/data.sql` + migration Spring Boot |
| Modifier le schéma SQLite | `newapp/src/main/resources/schema.sql` (compatible) |
| Ajouter une langue Kanban | `data.sql` (INSERT OR IGNORE) |
| Changer les profils admins | `src/App.tsx` (`ADMIN_PROFILES`) |
| Ajouter un module de reset | `DB/modules.json` + `src/services/resetApi.ts` |
