# API REST — GLPI Kanban

Base URL : `http://localhost:8080`

---

## Languages `/api/languages`

| Méthode  | URL                    | Description              |
|----------|------------------------|--------------------------|
| `GET`    | `/api/languages`       | Liste toutes les langues |
| `GET`    | `/api/languages/{id}`  | Obtenir une langue par ID |
| `POST`   | `/api/languages`       | Créer une langue          |
| `PUT`    | `/api/languages/{id}`  | Modifier une langue       |
| `DELETE` | `/api/languages/{id}`  | Supprimer une langue      |

### Exemple body (POST / PUT)
```json
{
  "code": "en",
  "name": "English",
  "isActive": 1
}
```

---

## Kanban Statuses `/api/kanban-statuses`

| Méthode  | URL                           | Description               |
|----------|-------------------------------|---------------------------|
| `GET`    | `/api/kanban-statuses`        | Liste tous les statuts    |
| `GET`    | `/api/kanban-statuses/{id}`   | Obtenir un statut par ID  |
| `POST`   | `/api/kanban-statuses`        | Créer un statut           |
| `PUT`    | `/api/kanban-statuses/{id}`   | Modifier un statut        |
| `DELETE` | `/api/kanban-statuses/{id}`   | Supprimer un statut       |

### Exemple body (POST / PUT)
```json
{
  "code": "IN_PROGRESS",
  "sortOrder": 2,
  "isActive": 1
}
```

---

## Kanban Status Labels `/api/kanban-status-labels`

| Méthode  | URL                                                  | Description                      |
|----------|------------------------------------------------------|----------------------------------|
| `GET`    | `/api/kanban-status-labels`                          | Liste tous les libellés          |
| `GET`    | `/api/kanban-status-labels/{id}`                     | Obtenir un libellé par ID        |
| `GET`    | `/api/kanban-status-labels/by-status/{statusId}`     | Libellés d'un statut             |
| `GET`    | `/api/kanban-status-labels/by-language/{languageId}` | Libellés d'une langue            |
| `POST`   | `/api/kanban-status-labels`                          | Créer un libellé                 |
| `PUT`    | `/api/kanban-status-labels/{id}`                     | Modifier un libellé              |
| `DELETE` | `/api/kanban-status-labels/{id}`                     | Supprimer un libellé             |

### Exemple body (POST / PUT)
```json
{
  "status":   { "id": 1 },
  "language": { "id": 1 },
  "label":    "Nouveau"
}
```

---

## Kanban Status Colors `/api/kanban-status-colors`

| Méthode  | URL                                              | Description                  |
|----------|--------------------------------------------------|------------------------------|
| `GET`    | `/api/kanban-status-colors`                      | Liste toutes les couleurs    |
| `GET`    | `/api/kanban-status-colors/{id}`                 | Obtenir une couleur par ID   |
| `GET`    | `/api/kanban-status-colors/by-status/{statusId}` | Couleurs d'un statut         |
| `POST`   | `/api/kanban-status-colors`                      | Créer une couleur            |
| `PUT`    | `/api/kanban-status-colors/{id}`                 | Modifier une couleur         |
| `DELETE` | `/api/kanban-status-colors/{id}`                 | Supprimer une couleur        |

### Exemple body (POST / PUT)
```json
{
  "status":          { "id": 1 },
  "backgroundColor": "#3498DB"
}
```

---

## Codes de réponse HTTP

| Code  | Signification              |
|-------|----------------------------|
| `200` | Succès                     |
| `204` | Suppression réussie        |
| `404` | Ressource introuvable      |
| `400` | Données invalides          |

---

> **Total : 22 endpoints**