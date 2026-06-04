# GLPI_NewApp

Application React + Node.js/Express + SQLite (tables custom) + MySQL (base GLPI).

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

## Bases de données

### SQLite — tables custom
Fichier : `DB/glpi.sqlite` — géré via l'extension **SQLite (alexcvzz)** dans VS Code.

### MySQL — base GLPI
Le serveur se connecte à MySQL avec ces paramètres par défaut :

| Variable          | Défaut      | Override via env        |
|-------------------|-------------|-------------------------|
| Hôte              | `localhost` | `MYSQL_HOST`            |
| Utilisateur       | `root`      | `MYSQL_USER`            |
| Mot de passe      | `root`      | `MYSQL_PASSWORD`        |
| Base de données   | `gpli`      | `MYSQL_DB`              |

---

## Réinitialisation par module (GLPI MySQL)

Accessible dans l'app via la section **Réinitialisation** (admins uniquement).

Les modules sont définis dans `DB/modules.json`. Chaque reset :
1. Fait un `mysqldump` des tables concernées dans `DB/backups/`
2. Exécute `TRUNCATE` sur les tables du module

### Ajouter un module

Éditez `DB/modules.json` :
```json
"Mon Module": {
  "description": "Description du module",
  "tables": ["glpi_ma_table1", "glpi_ma_table2"]
}
```

### Sauvegarde / Restauration manuelle

```powershell
# Sauvegarder toute la base
powershell -File DB/dump-glpi.ps1

# Restaurer la dernière sauvegarde
powershell -File DB/restore-glpi.ps1

# Restaurer un fichier précis
powershell -File DB/restore-glpi.ps1 -File "DB\backups\gpli_2026-06-04_150000.sql"
```

