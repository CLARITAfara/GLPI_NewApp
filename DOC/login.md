# GLPI_NewApp — Documentation technique

Application React/TypeScript greffée sur l'API REST haute performance de GLPI.  
Elle remplace l'interface Twig/jQuery historique de GLPI par un SPA moderne.

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Configuration](#2-configuration)
3. [Authentification et login](#3-authentification-et-login)
4. [Couche API](#4-couche-api)
5. [Gestion de l'état auth (React)](#5-gestion-de-létat-auth-react)
6. [Dashboard et sections](#6-dashboard-et-sections)
7. [Proxy Vite (développement)](#7-proxy-vite-développement)
8. [Arborescence des fichiers](#8-arborescence-des-fichiers)
9. [Démarrage rapide](#9-démarrage-rapide)

---

## 1. Architecture générale

```
Navigateur (React SPA)
      │
      │  OAuth 2.0 (password grant)
      │  Bearer token dans chaque requête
      ▼
Vite dev proxy  (/api → /api.php)   [dev uniquement]
      │
      ▼
GLPI back-end PHP
  ├── /api.php          Routeur principal de l'API REST
  ├── src/Glpi/Api/HL/  Contrôleurs High-Level (Tickets, Assets, Users…)
  └── src/Glpi/Api/HL/Middleware/OAuthRequestMiddleware  Validation Bearer
```

Le front n'accède **jamais** à la session PHP classique.  
Toute communication passe par l'API REST GLPI sécurisée par **OAuth 2.0**.

---

## 2. Configuration

Fichier : [`.env`](../.env) (copié depuis [`.env.example`](../.env.example))

| Variable | Rôle | Exemple |
|---|---|---|
| `VITE_API_BASE_URL` | Préfixe des URLs côté client | `/api` |
| `VITE_API_PROXY_TARGET` | URL racine de GLPI (dev uniquement) | `https://localhost/glpi/public` |
| `VITE_OAUTH_CLIENT_ID` | ID du client OAuth GLPI | `abc123` |
| `VITE_OAUTH_CLIENT_SECRET` | Secret du client OAuth GLPI | `secret456` |
| `VITE_OAUTH_SCOPES` | Scopes demandés | `api user email` |

> **Créer le client OAuth dans GLPI** : _Configuration > Générale > API > Clients OAuth_  
> Type de grant requis : **Password**.

Ces variables sont lues dans [`src/config.ts`](../src/config.ts) et injectées à la compilation par Vite (préfixe `VITE_` obligatoire pour l'exposition côté client).

---

## 3. Authentification et login

### 3.1 Flux OAuth 2.0 — Password Grant

```
LoginForm
  └─ login(username, password)          [AuthContext]
        └─ apiLogin(username, password) [api/auth.ts]
              └─ POST /api/token
                   body: {
                     grant_type: "password",
                     client_id, client_secret,
                     username, password, scope
                   }
                   ◄── { access_token, refresh_token, expires_in }
              └─ saveTokens(token)      [api/tokenStore.ts]
        └─ getSession()                 [api/auth.ts]
              └─ GET /api/session  (Bearer access_token)
                   ◄── { user_id, name, active_profile, … }
```

Le **Password Grant** échange directement l'identifiant/mot de passe contre un couple de tokens JWT.  
Aucune redirection vers une page de consentement externe n'est nécessaire.

### 3.2 Fichiers concernés

| Fichier | Rôle |
|---|---|
| [`src/api/auth.ts`](../src/api/auth.ts) | Fonctions bas-niveau : `login`, `logout`, `refresh`, `apiFetch`, `getSession` |
| [`src/api/tokenStore.ts`](../src/api/tokenStore.ts) | Persistance des tokens dans `localStorage` |
| [`src/api/types.ts`](../src/api/types.ts) | Types TypeScript : `TokenResponse`, `StoredTokens`, `Session` |
| [`src/config.ts`](../src/config.ts) | Lecture des variables d'environnement |
| [`src/auth/AuthContext.ts`](../src/auth/AuthContext.ts) | Contexte React + hook `useAuth()` |
| [`src/auth/AuthProvider.tsx`](../src/auth/AuthProvider.tsx) | Provider React : état global d'authentification |
| [`src/components/LoginForm.tsx`](../src/components/LoginForm.tsx) | Formulaire de connexion |

### 3.3 Gestion des erreurs OAuth

`auth.ts` traduit les codes d'erreur OAuth standard en messages lisibles en français :

| Code OAuth | Message affiché |
|---|---|
| `invalid_grant` | Identifiant ou mot de passe incorrect. |
| `invalid_client` | Client OAuth invalide (vérifiez les variables VITE_OAUTH_*). |
| `invalid_scope` | Scope OAuth invalide. |
| `unauthorized_client` | Ce client OAuth n'autorise pas la connexion par mot de passe. |
| `access_denied` | Accès refusé. |
| HTTP 400/401 | Identifiant ou mot de passe incorrect. |

### 3.4 Refresh automatique du token

`apiFetch()` gère le renouvellement transparent :

```
apiFetch(path, init)
  │
  ├─ Ajoute Authorization: Bearer <accessToken>
  ├─ Exécute la requête
  │
  └─ Si réponse 401 ──► refresh()
                           └─ POST /api/token  (grant_type: refresh_token)
                           └─ Si OK → saveTokens() puis relance la requête
                           └─ Si KO → clearTokens() (déconnexion forcée)
```

### 3.5 Persistance des tokens

Fichier : [`src/api/tokenStore.ts`](../src/api/tokenStore.ts)

```ts
// Structure stockée dans localStorage sous la clé "glpi_tokens"
{
  accessToken:  string   // JWT court-vivant (valide ~1h par défaut)
  refreshToken: string   // Jeton longue durée
  expiresAt:    number   // Epoch ms — calculé à la réception
}
```

Au démarrage de l'app, `AuthProvider` vérifie `localStorage` :  
- Token présent → appel `GET /api/session` pour valider → statut `authenticated`  
- Token absent ou session invalide → statut `unauthenticated` → affichage du formulaire

### 3.6 Déconnexion

```ts
logout()          // AuthProvider
  └─ clearTokens()       // supprime "glpi_tokens" de localStorage
  └─ setStatus('unauthenticated')
```

---

## 4. Couche API

### 4.1 `apiFetch` — requête authentifiée générique

Défini dans [`src/api/auth.ts`](../src/api/auth.ts).

```ts
apiFetch('/Assistance/Ticket?start=0&limit=20')
// → GET https://localhost/glpi/public/api.php/Assistance/Ticket?start=0&limit=20
//   Authorization: Bearer <token>
//   Accept: application/json
```

Toutes les fonctions de la couche API passent par `apiFetch` — le refresh est donc transparent partout.

### 4.2 `fetchList` — liste paginée

Défini dans [`src/api/glpi.ts`](../src/api/glpi.ts).

```ts
const { items, total } = await fetchList('/Assistance/Ticket', { start: 0, limit: 20 })
```

- Construit la query string `?start=N&limit=M`
- Lit l'entête **`Content-Range`** renvoyé par GLPI (ex : `0-19/143`) pour extraire le total
- Renvoie `{ items: GlpiRow[], total: number }`

### 4.3 `refName` — affichage des objets liés

```ts
refName({ id: 5, name: "Réseau local" })  // → "Réseau local"
refName(null)                              // → "—"
refName("texte brut")                     // → "texte brut"
```

L'API GLPI High-Level renvoie souvent des objets liés sous la forme `{ id, name }`.  
`refName` extrait le `name` ou retourne `"—"` si la valeur est absente.

### 4.4 `getSession` — profil de l'utilisateur connecté

```ts
const session = await getSession()
// → GET /api/session
// Retourne : { user_id, name, friendly_name, active_profile, profiles, … }
```

### 4.5 Endpoints GLPI utilisés

| Endpoint | Méthode | Données |
|---|---|---|
| `/token` | POST | Obtenir/rafraîchir un access_token |
| `/session` | GET | Profil utilisateur, rôle actif, entités |
| `/Assistance/Ticket` | GET | Liste des tickets ITSM |
| `/Assets/Computer` | GET | Liste des ordinateurs gérés |
| `/Administration/User` | GET | Liste des utilisateurs GLPI |

La liste complète des endpoints GLPI est disponible dans [`API/doc.json`](../API/doc.json) (format OpenAPI 3.x).

---

## 5. Gestion de l'état auth (React)

### 5.1 `AuthContext` et `useAuth()`

Fichier : [`src/auth/AuthContext.ts`](../src/auth/AuthContext.ts)

```ts
interface AuthContextValue {
  status:  'loading' | 'authenticated' | 'unauthenticated'
  session: Session | null
  error:   string | null
  login:   (username: string, password: string) => Promise<void>
  logout:  () => void
}
```

Le hook `useAuth()` donne accès au contexte depuis n'importe quel composant enfant.  
Il lève une erreur explicite si utilisé hors de `<AuthProvider>`.

### 5.2 `AuthProvider`

Fichier : [`src/auth/AuthProvider.tsx`](../src/auth/AuthProvider.tsx)

Responsabilités :
1. **Restauration au démarrage** — cherche les tokens dans `localStorage`, valide la session via `/api/session`
2. **`login()`** — appelle `apiLogin()` puis `getSession()`, met à jour l'état
3. **`logout()`** — purge les tokens, réinitialise l'état

### 5.3 Routage applicatif (App.tsx)

Fichier : [`src/App.tsx`](../src/App.tsx)

```
status === 'loading'         → <div>Chargement…</div>
status === 'authenticated'   → <Dashboard />
status === 'unauthenticated' → <LoginForm />
```

Pas de routeur tiers — la navigation est pilotée uniquement par le statut d'authentification.

---

## 6. Dashboard et sections

### 6.1 `sections.ts` — définition des vues

Fichier : [`src/sections.ts`](../src/sections.ts)

Chaque section décrit :
- `id` — identifiant interne
- `label` / `icon` — affichage dans le menu
- `endpoint` — route API GLPI à interroger
- `columns` — colonnes du tableau, avec `accessor` optionnel pour le rendu

```ts
const TICKETS: Section = {
  id: 'tickets',
  endpoint: '/Assistance/Ticket',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'priority', label: 'Priorité', accessor: (r) => PRIORITY[Number(r.priority)] },
    { key: 'date_creation', label: 'Créé le', accessor: (r) => formatDate(r.date_creation) },
    …
  ]
}
```

### 6.2 Sections selon le rôle GLPI

La fonction `sectionsForRole(profileName, iface)` filtre les sections visibles :

| Profil GLPI | Sections affichées |
|---|---|
| `Super-Admin`, `Admin`, `Supervisor` | Tickets · Ordinateurs · Utilisateurs |
| Technicien, Observateur… (`central`) | Tickets · Ordinateurs |
| Libre-service (`helpdesk`) | Mes tickets (seulement) |

### 6.3 `SectionView` — tableau de données

Fichier : [`src/components/SectionView.tsx`](../src/components/SectionView.tsx)

- Appelle `fetchList(section.endpoint, { limit: 20 })` au montage
- Affiche un spinner pendant le chargement, une erreur si l'appel échoue
- Rend un `<table>` avec les colonnes définies dans la section
- Affiche le total (`Content-Range`) en badge dans l'en-tête

### 6.4 `Dashboard`

Fichier : [`src/components/Dashboard.tsx`](../src/components/Dashboard.tsx)

- Affiche le nom et le rôle de l'utilisateur connecté (via `session`)
- Bouton "Se déconnecter" → appelle `logout()`
- Menu latéral navigable entre les sections disponibles

---

## 7. Proxy Vite (développement)

Fichier : [`vite.config.ts`](../vite.config.ts)

En développement, Vite proxy les appels `/api/*` vers GLPI pour éviter les erreurs CORS :

```
Client React                 Vite dev server               GLPI PHP
GET /api/session    ──────►  /api/session                  
                             rewrite → /api.php/session  ──►  répond JSON
```

La réécriture remplace `/api` par `/api.php` (point d'entrée GLPI).  
`secure: false` accepte les certificats HTTPS auto-signés du serveur local (XAMPP).

En **production**, configurer un reverse-proxy Apache/Nginx pour rediriger `/api/*` vers GLPI.

---

## 8. Arborescence des fichiers

```
GLPI_NewApp/
├── API/
│   └── doc.json               Spécification OpenAPI 3.x de GLPI
├── doc/
│   └── README.md              Ce fichier
├── src/
│   ├── api/
│   │   ├── auth.ts            login, logout, refresh, apiFetch, getSession
│   │   ├── glpi.ts            fetchList, refName
│   │   ├── tokenStore.ts      saveTokens, getTokens, clearTokens (localStorage)
│   │   └── types.ts           TokenResponse, StoredTokens, Session, ActiveProfile
│   ├── auth/
│   │   ├── AuthContext.ts     createContext + hook useAuth()
│   │   └── AuthProvider.tsx   État global auth, restauration au démarrage
│   ├── components/
│   │   ├── Dashboard.tsx      Interface principale post-login
│   │   ├── LoginForm.tsx      Formulaire de connexion
│   │   └── SectionView.tsx    Tableau de données par section
│   ├── App.tsx                Routage loading / login / dashboard
│   ├── config.ts              Variables d'environnement Vite
│   ├── format.ts              Utilitaires de formatage (dates…)
│   ├── main.tsx               Point d'entrée React
│   └── sections.ts            Définition des sections et logique de rôle
├── .env                       Variables locales (non commité)
├── .env.example               Template de configuration
├── vite.config.ts             Proxy dev + plugin React
└── package.json
```

---

## 9. Démarrage rapide

```bash
# 1. Copier et remplir la configuration
cp .env.example .env
# Renseigner VITE_OAUTH_CLIENT_ID et VITE_OAUTH_CLIENT_SECRET
# (créer le client dans GLPI : Configuration > Générale > API > Clients OAuth)

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
# → http://localhost:5173

# 4. Build de production
npm run build
# → dist/  (à déployer derrière Apache/Nginx avec proxy /api → GLPI)
```

> **Prérequis GLPI** : version 10+ avec l'API High-Level activée  
> (_Configuration > Générale > API_ → "Activer l'API REST")


powershell -File c:\xampp\htdocs\glpi\GLPI_NewApp\DB\dump-glpi.ps1


# Prend automatiquement la sauvegarde la plus récente
powershell -File c:\xampp\htdocs\glpi\GLPI_NewApp\DB\restore-glpi.ps1

# Ou un fichier précis
powershell -File c:\xampp\htdocs\glpi\GLPI_NewApp\DB\restore-glpi.ps1 -File "DB\backups\glpi_2026-06-04_153000.sqlite"
