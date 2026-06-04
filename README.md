# GLPI_NewApp

Application React + Node.js/Express + SQLite.

---

## Structure du projet

```
GLPI_NewApp/
├── src/          # Frontend React (Vite + TypeScript)
├── server/       # Backend Node.js/Express
└── DB/
    └── glpi.sqlite
```

---

## Installation

### 1. Frontend (React)

```powershell
cd GLPI_NewApp
npm install
```

### 2. Backend (Node.js)

```powershell
cd GLPI_NewApp/server
npm install
```

---

## Démarrage

Lancer les deux terminaux en même temps.

### Terminal 1 — Backend (API)

```powershell
cd GLPI_NewApp/server
npm run dev
```

L'API tourne sur **http://localhost:3001**

### Terminal 2 — Frontend (React)

```powershell
cd GLPI_NewApp
npm run dev
```

L'app tourne sur **http://localhost:5173**

---

## API automatique — comment ça marche

Le serveur **détecte automatiquement toutes les tables** du fichier SQLite au démarrage et génère les routes CRUD correspondantes. Aucun code à écrire.

### Workflow pour ajouter une nouvelle table

1. Créer la table dans VS Code avec l'extension SQLite (`Ctrl+Shift+P` → `SQLite: Run Query`)
2. Redémarrer le serveur (`Ctrl+C` puis `npm run dev`)
3. Les routes sont disponibles immédiatement

### Routes générées pour chaque table

| Méthode | URL                       | Description                  |
|---------|---------------------------|------------------------------|
| GET     | /api/:table               | Récupérer toutes les lignes  |
| GET     | /api/:table/:id           | Récupérer une ligne par id   |
| POST    | /api/:table               | Créer une ligne              |
| PUT     | /api/:table/:id           | Modifier une ligne           |
| DELETE  | /api/:table/:id           | Supprimer une ligne          |
| GET     | /api                      | Lister toutes les tables et leurs routes |

### Exemples

**Voir toutes les routes disponibles :**
```
GET http://localhost:3001/api
```

**Créer un enregistrement (POST) :**
```json
POST http://localhost:3001/api/tickets
{
  "titre": "Problème réseau",
  "statut": "ouvert",
  "priorite": 2
}
```

**Modifier un enregistrement (PUT) :**
```json
PUT http://localhost:3001/api/tickets/1
{
  "statut": "fermé"
}
```

---

## Base de données

Fichier SQLite : `DB/glpi.sqlite`

Géré via l'extension **SQLite (alexcvzz)** dans VS Code.

Pour ouvrir et exécuter des requêtes :
- `Ctrl+Shift+P` → `SQLite: Open Database`
- `Ctrl+Shift+P` → `SQLite: New Query`
- `Ctrl+Shift+P` → `SQLite: Run Query`

