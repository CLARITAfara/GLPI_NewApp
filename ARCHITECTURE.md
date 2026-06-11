# ARCHITECTURE.md — Documentation technique de GLPI_NewApp

> Ce document décrit l'architecture réelle du projet, déduite de l'analyse du code source.
> Aucune supposition n'a été faite : tout ce qui est documenté ici est présent dans le code.

---

## 1. Vue globale de l'application

GLPI_NewApp est une application web composée de deux parties distinctes qui communiquent chacune avec des systèmes différents :

```
┌─────────────────────────────────────────────────────────┐
│                    Navigateur (SPA React)                │
│                                                         │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │   Back-office   │    │      Front-office        │   │
│  │  /login /admin  │    │  / /kanban /tickets/...  │   │
│  └────────┬────────┘    └────────────┬─────────────┘   │
└───────────┼─────────────────────────┼─────────────────┘
            │                         │
     OAuth Password              OAuth Auto-login
     Grant (admin)               (VITE_GLPI_USERNAME)
            │                         │
            ▼                         ▼
┌──────────────────────────────────────────────────────┐
│                    Instance GLPI                      │
│              (API OAuth + REST HL + Legacy)           │
│                                                       │
│  /api.php/token          (authentification)           │
│  /api.php/session        (infos session)              │
│  /api.php/Assistance/Ticket    (tickets)              │
│  /api.php/Assets/Computer      (assets)               │
│  /api.php/Administration/User  (utilisateurs)         │
│  /api.php/ITILSolution         (solutions)            │
│  /api/v1/*                     (API legacy)           │
└──────────────────────────────────────────────────────┘

            │ /kanban-api/*
            ▼
┌──────────────────────────────────────────────────────┐
│              Spring Boot (port 8080)                  │
│           Microservice Kanban Config                  │
│                                                       │
│  /api/languages                (langues)              │
│  /api/kanban-statuses          (statuts colonnes)     │
│  /api/kanban-status-colors     (couleurs)             │
│  /api/kanban-status-labels     (libellés i18n)        │
│                                                       │
│  SQLite : newapp/newapp.db                            │
└──────────────────────────────────────────────────────┘
```

---

## 2. Diagramme textuel des modules

```
src/
├── [ROUTING] App.tsx
│       ├── AuthContext (état global d'auth)
│       ├── /login → LoginPage → LoginForm → apiClient (OAuth)
│       ├── /admin → DashboardPage → Dashboard
│       │       ├── Sidebar (sectionsForRole)
│       │       ├── Breadcrumb
│       │       └── SectionView / StatsView / TicketsView /
│       │           ImportPanel / ResetPanel / KanbanConfigPanel
│       └── / → FrontAutoLogin → FrontLayout
│               ├── FrontDashboard (index)
│               ├── /kanban → KanbanBoard
│               └── /tickets/create → CreateTicketPanel
│
├── [STATE] context/
│       ├── AuthProvider   ← wraps App, stocke {status, session}
│       └── AuthContext    ← expose useAuth()
│
├── [CONFIG] config.ts     ← lit VITE_* depuis import.meta.env
│
├── [NAVIGATION] sections.ts
│       └── sectionsForRole(profileName, iface) → Section[]
│
└── [SERVICES] services/
        ├── [AUTH]
        │   ├── apiClient.ts       ← OAuth fetch + refresh 401
        │   ├── frontSession.ts    ← Auto-login front (session séparée)
        │   └── tokenStore.ts      ← localStorage get/set/clear
        │
        ├── [GLPI HIGH-LEVEL]
        │   ├── glpiApi.ts         ← fetchAll, fetchCount, fetchPage
        │   ├── ticketsApi.ts      ← tickets admin (GLPI)
        │   ├── ticketCreateApi.ts ← création ticket + matrice priorité
        │   ├── ticketsFrontApi.ts ← Kanban front (créer, déplacer)
        │   ├── computerApi.ts     ← assets Computer
        │   ├── userApi.ts         ← utilisateurs
        │   └── elementsApi.ts     ← recherche multi-types
        │
        ├── [GLPI LEGACY]
        │   └── legacyApi.ts       ← /api/v1 (upload docs, logs, types legacy)
        │
        ├── [KANBAN CONFIG → Spring Boot]
        │   └── kanbanConfigApi.ts ← /kanban-api/* (statuts, couleurs, labels)
        │
        ├── [IMPORT CSV]
        │   ├── importSchemas.ts   ← ITEM_TYPES, SCHEMAS, tables de correspondance
        │   ├── importValidation.ts ← validation cellule par cellule
        │   ├── importApi.ts       ← pipeline 6 étapes + rollback LIFO
        │   └── csvUtil.ts         ← parse/serialize CSV pur (RFC 4180)
        │
        ├── [RESET]
        │   └── resetApi.ts        ← suppression sélective par module
        │
        ├── [STATS]
        │   └── statsApi.ts        ← comptages agrégés (read-only)
        │
        └── [UTILITAIRES]
            └── concurrency.ts     ← pool borné (N tâches simultanées max)
```

---

## 3. Description des couches

### Couche Présentation (Pages + Composants)
- **Pages** (`src/pages/`) : conteneurs de haut niveau, lisent l'état auth, délèguent aux composants
- **Composants admin** (`src/components/`) : IU des sections admin — data fetching via services
- **Composants front** (`src/components/front/`) : IU self-service — consomment les services front

### Couche Service (src/services/)
- **Unique responsabilité** : tous les appels réseau passent ici, jamais dans les composants
- **Isolation des erreurs** : chaque service parse les erreurs GLPI et retourne des types métier
- **Aucun état global** : les services sont des fonctions pures (pas de classes, pas de singletons)

### Couche Contexte (src/context/)
- **`AuthProvider`** : état d'authentification admin (`status: 'loading'|'authenticated'|'unauthenticated'`, `session`)
- **`AuthContext`** : hook `useAuth()` pour lire cet état dans n'importe quel composant

### Couche Backend (Spring Boot)
- **Contrôleurs** : reçoivent HTTP, valident, délèguent aux services
- **Services** : logique métier (upsert, find-or-create)
- **Repositories** : interfaces `JpaRepository`, pas de SQL manuel
- **Modèles** : entités JPA avec annotations Lombok + JPA

---

## 4. Flux de données

### Authentification admin
```
LoginForm
  → apiClient.authenticate(username, password)
      → POST /api/token (OAuth password grant)
      ← {access_token, refresh_token, expires_in}
      → tokenStore.set(tokens)
      → GET /api/session
      ← {active_profile: {name}, default_interface}
  → AuthProvider.setSession(session)
  → App.tsx : isAdmin = ADMIN_PROFILES.includes(session.active_profile.name)
  → Redirect /admin
```

### Rafraîchissement de token (automatique)
```
apiClient.apiFetch(url)
  → 401 response
  → POST /api/token (grant_type=refresh_token)
  ← nouveau access_token
  → tokenStore.set(nouveaux tokens)
  → retry requête originale
```

### Auto-login front-office
```
FrontAutoLogin (outlet parent, monté une fois)
  → frontSession.initFrontSession()
      → POST /api/token (credentials depuis config.ts)
      → GET /api/session
  → Outlet (FrontLayout) se monte avec session établie
```

### Import CSV (6 étapes)
```
ImportPanel
  → importValidation.validerFichiers(csvInventaire, csvTickets, csvCouts)
      ← [] (OK) ou [{fichier, ligne, colonne, valeur, message}]
  → importApi.importerDonnees(données validées)
      Étape 1 : Créer/réutiliser assets (GLPI HL ou legacy)
        → Pour chaque ligne inventaire : glpiApi.findOrCreate(itemType, name)
        → Dropdowns (Location, Manufacturer, State) créés à la volée
      Étape 2 : Upload images (API legacy /api/v1)
        → legacyApi.uploadDocument(file, entityId)
      Étape 3 : Créer tickets (status initial = NEW)
        → ticketCreateApi.creerTicket(data)
      Étape 4 : Créer coûts de ticket
        → glpiApi.post('/Assistance/TicketCost', cout)
      Étape 5 : Lier assets aux tickets
        → glpiApi.post('/Assistance/Item_Ticket', lien)
      Étape 6 : Appliquer statut final
        → glpiApi.patch('/Assistance/Ticket/{id}', {status})
      Sur ERREUR à toute étape :
        → rollbackStack.forEach(fn => fn()) // LIFO
```

### Kanban Board (front-office)
```
KanbanBoard
  → kanbanConfigApi.getStatuts() (Spring Boot /kanban-api/kanban-statuses)
  → ticketsFrontApi.fetchKanbanTickets()
      → fetchAll('/api/Assistance/Ticket', filtres)
  → Colonnes construites : NEW [status=1], IN_PROGRESS [status=2,3,4,10], DONE [status=5,6]
  
  Drag-drop vers DONE :
    → modal "Saisir une solution"
    → ticketsFrontApi.creerSolution(ticketId, solution)
        → POST /api/ITILSolution
    → ticketsFrontApi.changerStatut(ticketId, 6)
        → PATCH /api/Assistance/Ticket/{id} {status: 6}
```

---

## 5. Relations entre les composants

```
App.tsx
  └── AuthProvider (wraps everything)
      ├── LoginPage
      │   └── LoginForm ──→ apiClient (auth)
      ├── DashboardPage
      │   └── Dashboard
      │       ├── Sidebar ──→ sectionsForRole() ──→ sections.ts
      │       ├── Breadcrumb
      │       └── [selon section active]
      │           ├── StatsView ──→ statsApi
      │           ├── TicketsView/TicketList ──→ ticketsApi
      │           ├── SectionView ──→ glpiApi (générique)
      │           ├── ImportPanel ──→ importValidation + importApi
      │           ├── ResetPanel ──→ resetApi
      │           └── KanbanConfigPanel ──→ kanbanConfigApi
      └── FrontAutoLogin (init session front)
          └── FrontLayout
              ├── ElementsPanel
              │   ├── ElementsFilters ──→ elementsApi
              │   └── ElementsTable + ItemSelector
              ├── KanbanBoard ──→ ticketsFrontApi + kanbanConfigApi
              └── CreateTicketPanel ──→ ticketCreateApi
```

---

## 6. API GLPI utilisées

### API High-Level (OAuth, via `/api.php/`)

| Endpoint | Usage |
|---|---|
| `POST /token` | Authentification OAuth (password grant + refresh) |
| `GET /session` | Informations de session (profil, interface) |
| `GET /Assistance/Ticket` | Liste des tickets (paginated) |
| `POST /Assistance/Ticket` | Création de ticket |
| `PATCH /Assistance/Ticket/{id}` | Mise à jour de ticket (statut) |
| `GET /Assistance/TicketCost` | Coûts d'un ticket |
| `POST /Assistance/TicketCost` | Création de coût |
| `POST /Assistance/Item_Ticket` | Liaison asset-ticket |
| `POST /ITILSolution` | Création d'une solution (fermeture) |
| `GET /Assets/{Type}` | Liste des assets par type |
| `POST /Assets/{Type}` | Création d'un asset |
| `GET /Dropdowns/{Model}` | Liste des valeurs dropdown |
| `POST /Dropdowns/{Model}` | Création de valeur dropdown |
| `GET /Administration/User` | Liste des utilisateurs |
| `POST /Administration/User` | Création d'utilisateur |

### API REST Legacy (User-Token, via `/api/v1/` ou `/apirest.php/`)

| Endpoint | Usage |
|---|---|
| `POST /Document` | Upload de document (image liée à un asset) |
| `POST /Document_Item` | Liaison document-item |
| `POST /CartridgeItem` | Création cartouche (pas de route HL) |
| `POST /ConsumableItem` | Création consommable (pas de route HL) |
| Autres types legacy | Selon `viaLegacy: true` dans `ITEM_TYPES` |

### Pagination GLPI
- GLPI pagine par défaut à 20 items
- `fetchAll` dans `glpiApi.ts` boucle jusqu'à épuisement (range 0-N par tranche)
- `fetchCount` lit le header `Content-Range: items 0-N/TOTAL` (retourne TOTAL)
- 404 = 0 résultats (pas une erreur)

---

## 7. Microservice Spring Boot — Endpoints

Base URL : `http://localhost:8080/api` (proxied via `/kanban-api` en dev)

### Languages
| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/languages` | Toutes les langues actives |
| `POST` | `/languages` | Créer une langue |
| `PUT` | `/languages/{id}` | Mettre à jour une langue |

### Kanban Statuses
| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/kanban-statuses` | Tous les statuts (ordonnés par sort_order) |
| `GET` | `/kanban-statuses/{id}` | Un statut par ID |
| `POST` | `/kanban-statuses` | Créer un statut |
| `PUT` | `/kanban-statuses/{id}` | Mettre à jour un statut |

### Kanban Status Colors
| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/kanban-status-colors` | Toutes les couleurs |
| `GET` | `/kanban-status-colors/by-status/{statusId}` | Couleur d'un statut |
| `POST` | `/kanban-status-colors` | Créer ou mettre à jour (upsert) |
| `PUT` | `/kanban-status-colors/{id}` | Mettre à jour existant |

### Kanban Status Labels
| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/kanban-status-labels` | Tous les libellés |
| `GET` | `/kanban-status-labels/by-status/{statusId}` | Libellés d'un statut |
| `POST` | `/kanban-status-labels` | Créer ou mettre à jour (upsert) |
| `PUT` | `/kanban-status-labels/{id}` | Mettre à jour existant |

---

## 8. Modèles métier

### Entités GLPI (côté frontend — types TypeScript dans `glpiApi.ts`)

```typescript
GlpiRow = Record<string, unknown>  // ligne générique GLPI

// Ticket GLPI (champs utilisés)
{
  id: number
  name: string              // titre
  content: string           // description
  status: number            // 1=new, 2=assigned, 3=planned, 4=pending, 5=solved, 6=closed
  priority: number          // 1..6
  type: number              // 1=incident, 2=request
  date: string              // date de création
  entities_id: number
  users_id_recipient: number
}

// Asset GLPI (champs utilisés selon type)
{
  id: number
  name: string
  status?: { id: number, name: string }  // ou state selon statusField
  location?: { id: number, name: string }
  manufacturer?: { id: number, name: string }
  users_id_tech?: number
  otherserial?: string   // numéro d'inventaire
}
```

### Entités SQLite (Spring Boot — JPA)

```
Language {
  id: Long (PK autoincrement)
  code: String (UNIQUE, ex. "mg", "fr", "en")
  name: String (ex. "Malagasy")
  isActive: boolean (DEFAULT true)
  createdAt: LocalDateTime
}

KanbanStatus {
  id: Long (PK autoincrement)
  code: String (UNIQUE, ex. "NEW", "IN_PROGRESS", "DONE")
  sortOrder: int
  isActive: boolean (DEFAULT true)
  createdAt: LocalDateTime
}

KanbanStatusLabel {
  id: Long (PK autoincrement)
  statusId: Long (FK → KanbanStatus, CASCADE DELETE)
  languageId: Long (FK → Language, CASCADE DELETE)
  label: String
  createdAt: LocalDateTime
  createdBy: Long (nullable)
  UNIQUE(statusId, languageId)
}

KanbanStatusColor {
  id: Long (PK autoincrement)
  statusId: Long (FK → KanbanStatus, CASCADE DELETE)
  backgroundColor: String (ex. "#3b82f6")
  createdAt: LocalDateTime
  createdBy: Long (nullable)
  UNIQUE(statusId)
}
```

---

## 9. Base de données

### SQLite (microservice)

**Fichier** : `newapp/newapp.db` (créé au démarrage si absent)

**Initialisation** :
1. `schema.sql` : `CREATE TABLE IF NOT EXISTS` (idempotent, exécuté à chaque démarrage)
2. `data.sql` : `INSERT OR IGNORE` (idempotent, données initiales)
3. `spring.jpa.hibernate.ddl-auto=none` : Hibernate ne touche pas au schéma

**Données initiales** :
- 1 langue : Malagasy (`mg`)
- 3 statuts Kanban : `NEW` (sort=1), `IN_PROGRESS` (sort=2), `DONE` (sort=3)
- 3 labels en Malagasy : "Vaovao", "Efa manao", "Vita"

**Contraintes importantes** :
- `UNIQUE(status_id, language_id)` sur `kanban_status_labels` → upsert côté service
- `UNIQUE(status_id)` sur `kanban_status_colors` → une seule couleur par statut
- `CASCADE DELETE` : supprimer un statut supprime ses labels et couleurs

### GLPI (base externe)

Gérée par l'instance GLPI — l'application n'y accède qu'en lecture/écriture via API.
Aucun accès direct à la base GLPI n'est fait (pas de JDBC vers MySQL/PostgreSQL GLPI).

---

## 10. Authentification

### Back-office (Admin)
- **Protocole** : OAuth 2.0 Password Grant Flow
- **Token endpoint** : `POST /api/token`
- **Body** : `grant_type=password&client_id=...&client_secret=...&username=...&password=...&scope=api user email`
- **Stockage** : `localStorage` via `tokenStore.ts`
- **Refresh** : automatique sur 401, via `grant_type=refresh_token`
- **Session** : `GET /api/session` retourne `{active_profile, default_interface, ...}`
- **Profils autorisés** : `Super-Admin`, `Admin`, `Supervisor` (défini dans `App.tsx`)

### Front-office (Auto-login)
- **Même protocole** OAuth Password Grant
- **Credentials** : `config.glpiUsername` / `config.glpiPassword` (variables d'env)
- **Session séparée** : `frontSession.ts` maintient ses propres tokens
- **Pas d'interface de login** : transparent pour l'utilisateur

### API Legacy (User-Token)
- **Header** : `Authorization: user_token XXXXX`
- **Optionnel** : `X-Glpi-App-Token: XXXXX`
- **Usage** : upload documents, types legacy (CartridgeItem, ConsumableItem)
- **Configuré via** : `VITE_GLPI_USER_TOKEN` (jeton personnel dans Préférences GLPI)

---

## 11. Permissions et rôles

### Côté Frontend

| Profil GLPI | Interface | Sections accessibles |
|---|---|---|
| Super-Admin | central | Stats, Tickets, Kanban, Ordinateurs, Utilisateurs, Import, Réinit. |
| Admin | central | Idem |
| Supervisor | central | Idem |
| Autres profils central | central | Stats, Tickets, Ordinateurs |
| helpdesk | helpdesk | Mes tickets (uniquement) |
| (non authentifié) | — | Front-office uniquement |

La fonction `sectionsForRole(profileName, iface)` dans `sections.ts` est la source de vérité.

### Côté GLPI (serveur)
- GLPI gère ses propres permissions par entité et par profil
- L'application ne fait que relayer : si GLPI retourne 403, l'action échoue
- Les droits de création/modification dépendent de la configuration GLPI

### Logins protégés (Reset)
Ces logins ne peuvent pas être supprimés par le module de réinitialisation :
`glpi`, `glpi-system`, `post-only`, `tech`, `normal`

---

## 12. Dépendances importantes

### Frontend (`package.json`)
```json
{
  "react": "^19.2.6",
  "react-dom": "^19.2.6",
  "react-router-dom": "^7.17.0",
  "bootstrap-icons": "^1.13.1"
}
```

### Backend (`newapp/pom.xml`)
```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.0.6</version>
</parent>

<!-- Dépendances clés -->
spring-boot-starter-data-jpa
spring-boot-starter-validation
spring-boot-starter-web
org.xerial:sqlite-jdbc:3.50.1.0
org.hibernate.orm:hibernate-community-dialects (SQLite dialect)
org.projectlombok:lombok
```

---

## 13. Registre des types d'assets (Source de vérité)

`src/services/importSchemas.ts` — `ITEM_TYPES` — 19 types gérés :

| itemType | Endpoint HL | Statut field | Champs | Particularité |
|---|---|---|---|---|
| Computer | /Assets/Computer | status | CHAMPS_STD | — |
| Monitor | /Assets/Monitor | status | CHAMPS_STD | — |
| NetworkEquipment | /Assets/NetworkEquipment | status | CHAMPS_STD | — |
| Peripheral | /Assets/Peripheral | status | CHAMPS_STD | — |
| Phone | /Assets/Phone | status | CHAMPS_STD | — |
| Printer | /Assets/Printer | status | CHAMPS_STD | — |
| Rack | /Assets/Rack | state | CHAMPS_STD | Datacenter |
| Enclosure | /Assets/Enclosure | state | CHAMPS_STD | Datacenter, a un modèle |
| PDU | /Assets/PDU | state | CHAMPS_STD | Datacenter |
| PassiveDCEquipment | /Assets/PassiveDCEquipment | state | CHAMPS_STD | Datacenter |
| Software | /Assets/Software | — | location, manufacturer, user | Pas de statut |
| SoftwareLicense | /Assets/SoftwareLicense | status | CHAMPS_STD | — |
| Certificate | /Assets/Certificate | status | CHAMPS_STD | — |
| Cable | /Assets/Cable | state | user, otherserial | Champs réduits |
| Socket | /Assets/Socket | — | location | `sansCorbeille`, itemtype namespaced |
| Appliance | /Assets/Appliance | status | CHAMPS_STD | — |
| Unmanaged | /Assets/Unmanaged | status | manufacturer, user, otherserial | Pas de location |
| CartridgeItem | /Assets/CartridgeItem | — | location, manufacturer | `viaLegacy: true` |
| ConsumableItem | /Assets/ConsumableItem | — | location, manufacturer | `viaLegacy: true` |

`CHAMPS_STD = ['location', 'manufacturer', 'user', 'otherserial']`

---

## 14. Schémas CSV d'import

Trois fichiers CSV attendus simultanément :

### Feuille 1 — Inventaire
| Colonne | Règle | Notes |
|---|---|---|
| Name | texte | Obligatoire |
| Status | texte-optionnel | Valeur libre (dropdown GLPI) |
| Location | texte-optionnel | Valeur libre (dropdown GLPI) |
| Manufacturer | texte-optionnel | Valeur libre (dropdown GLPI) |
| Item_Type | enum | Mapping vers TYPES_ITEM (FR/EN/synonymes) |
| Model | texte-optionnel | Valeur libre (dropdown GLPI) |
| Inventory_Number | texte-optionnel | → otherserial |
| User | texte-optionnel | Login GLPI ou nom |

### Feuille 2 — Tickets
| Colonne | Règle | Notes |
|---|---|---|
| Ref_Ticket | texte | Clé interne (non envoyée à GLPI) |
| Date | date | JJ/MM/AAAA ou YYYY-MM-DD |
| Heure | heure-hhmm | HH:MM |
| Type | enum | incident/request/demande |
| Titre | texte | Obligatoire |
| Description | texte | Obligatoire |
| Status | enum | new/assigned/in progress/solved/closed... |
| Priority | enum | 1..6 ou very low/low/medium/high/... |
| Items | json-array | Tableau JSON des noms d'assets liés |

### Feuille 3 — Coûts
| Colonne | Règle | Notes |
|---|---|---|
| Num_Ticket | texte | Doit correspondre à un Ref_Ticket Feuille 2 |
| Duration_second | nombre-fr-optionnel | Durée en secondes (virgule FR acceptée) |
| Time_Cost | nombre-fr-optionnel | Coût horaire |
| Fixed_Cost | nombre-fr-optionnel | Coût fixe |

---

## 15. Matrice de priorité GLPI

Définie dans `ticketCreateApi.ts` — conversion urgence × impact → priorité :

```
         Impact
          1    2    3    4    5
Urgence 1 [5,  5,  4,  3,  2]
        2 [5,  4,  3,  2,  1]
        3 [4,  3,  3,  2,  1]
        4 [3,  2,  2,  1,  1]
        5 [2,  1,  1,  1,  1]
```

---

## 16. Gestion de la concurrence

`src/services/concurrency.ts` expose un pool d'exécution borné :

```typescript
pool(tasks: (() => Promise<T>)[], maxConcurrent: number): Promise<T[]>
```

- Utilisé dans `importApi.ts` (8 concurrent max) pour les assets
- Utilisé dans `resetApi.ts` (8 concurrent max) pour la suppression
- Empêche de saturer l'API GLPI avec des centaines de requêtes simultanées
- Garantit l'ordre des résultats malgré l'exécution parallèle

---

## 17. Points d'extension futurs

Zones du code conçues pour être extensibles sans refactoring majeur :

1. **Nouveaux types d'assets** : ajouter une entrée dans `ITEM_TYPES` et `TYPES_ITEM` dans `importSchemas.ts`
2. **Nouvelles sections admin** : ajouter un `Section` dans `sections.ts` et son composant correspondant dans `SectionView.tsx`
3. **Nouvelles langues Kanban** : ajouter une ligne dans `data.sql` (table `languages`) et des labels dans `kanban_status_labels`
4. **Nouveaux statuts Kanban** : ajouter dans `data.sql` + adapter le mapping dans `ticketsFrontApi.ts`
5. **Nouveaux modules de reset** : ajouter dans `DB/modules.json` + adapter `resetApi.ts`
6. **Nouvelles colonnes CSV** : ajouter dans le schéma correspondant dans `importSchemas.ts` + adapter `importApi.ts`
7. **Nouveaux profils admin** : modifier `ADMIN_PROFILES` dans `App.tsx` et `sectionsForRole` dans `sections.ts`

---

## 18. Dette technique identifiée

1. **`ticketApi.ts`** : service présent dans `services/` qui semble référencer une API locale (`http://localhost:3001/api` via `VITE_LOCAL_API_URL`) — non utilisée dans les routes connues ; vérifier si obsolète ou en cours d'intégration.

2. **`FrontPage.tsx`** : page présente dans `src/pages/` mais non référencée comme route directe dans `App.tsx` — vérifier si utilisée ou résiduelle.

3. **Secrets dans `.env`** : les credentials OAuth sont dans `.env` en clair ; pour un déploiement production, considérer un gestionnaire de secrets.

4. **Pas de tests frontend** : aucun fichier de test (`*.test.ts`, `*.spec.ts`) détecté dans `src/` ; les flux critiques (import, rollback, auth) ne sont pas couverts par des tests automatisés.

5. **`secure: false` dans vite.config.ts** : nécessaire en dev avec certificat auto-signé GLPI ; ne pas reproduire en configuration de proxy de production.

6. **`VITE_LOCAL_API_URL`** dans `config.ts` pointe vers `http://localhost:3001/api` — aucun service Node.js sur ce port n'est documenté dans le projet ; probable vestige ou fonctionnalité en développement.

7. **Pas de DELETE sur les endpoints Spring Boot** : les statuts et couleurs Kanban ne peuvent pas être supprimés via l'API locale (seulement créés/mis à jour).
