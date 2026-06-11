# Guide — Backend Spring Boot (`newapp`)

API REST Java qui gère la **configuration du Kanban** (statuts, libellés multilingues, couleurs) dans une base **SQLite** locale. Elle est séparée de GLPI : le front React l'appelle via le proxy Vite `/kanban-api` → `http://localhost:8080/api`.

> Ce module est **autonome** : il ne touche ni à GLPI, ni à la base GLPI. Sa seule donnée est `newapp.db` (SQLite).

---

## 1. Stack technique

| Élément | Choix |
|---------|-------|
| Framework | Spring Boot **4.0.6** |
| Java | **17** |
| Build | Maven (wrapper `mvnw` fourni) |
| Base de données | **SQLite** (`newapp.db`, fichier local) |
| ORM | Spring Data JPA + Hibernate (dialecte communautaire SQLite) |
| Boilerplate | **Lombok** (`@Getter`, `@Setter`…) |
| Validation | `spring-boot-starter-validation` (`@Valid`) |
| Web | `spring-boot-starter-webmvc` (REST) |

Dépendances déclarées dans [pom.xml](pom.xml).

---

## 2. Lancer le backend

Depuis le dossier `newapp/` :

```bash
# Windows
.\mvnw.cmd spring-boot:run

# Linux / Mac
./mvnw spring-boot:run
```

- Démarre sur **http://localhost:8080**
- Tester : `GET http://localhost:8080/api/kanban-statuses`

| Commande | Rôle |
|----------|------|
| `mvnw spring-boot:run` | Lance l'appli (dev) |
| `mvnw clean package` | Compile + tests → `target/newapp-0.0.1-SNAPSHOT.jar` |
| `mvnw test` | Tests uniquement |
| `java -jar target/newapp-0.0.1-SNAPSHOT.jar` | Lance le JAR packagé |

### Lien avec le front React

Le proxy Vite ([../vite.config.ts](../vite.config.ts)) redirige :

```
/kanban-api/...  →  http://localhost:8080/api/...
```

Donc côté React, on appelle `/kanban-api/kanban-statuses` et ça arrive sur ce backend. Les deux serveurs (`npm run dev` sur 5173 et Spring Boot sur 8080) doivent tourner en même temps.

---

## 3. Configuration ([application.properties](src/main/resources/application.properties))

```properties
spring.application.name=newapp

# SQLite : un simple fichier newapp.db à la racine du module
spring.datasource.url=jdbc:sqlite:newapp.db
spring.datasource.driver-class-name=org.sqlite.JDBC

# Hibernate ne crée PAS les tables (ddl-auto=none) :
# c'est schema.sql qui gère le schéma.
spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=true

# Au démarrage : exécute schema.sql puis data.sql
spring.sql.init.mode=always
```

**Point important** : le schéma vient de `schema.sql`, **pas** d'Hibernate. Si tu ajoutes une table/colonne, tu modifies :
1. `src/main/resources/schema.sql` (DDL)
2. L'entité Java correspondante (mapping)
Les deux doivent rester cohérents.

---

## 4. Architecture en couches

Le code suit le découpage classique Spring (un package par responsabilité) :

```
src/main/java/com/glpi/newapp/
├── NewappApplication.java     Point d'entrée (@SpringBootApplication)
├── model/         Entités JPA (= tables)
├── repository/    Accès données (interfaces JpaRepository)
├── service/       Logique métier
└── controller/    Endpoints REST (@RestController)
```

**Flux d'une requête :**

```
HTTP  →  Controller  →  Service  →  Repository  →  SQLite
                ↑           ↑            ↑
           (REST/JSON)  (métier)    (SQL via JPA)
```

Chaque couche ne connaît que la couche juste en dessous. On n'appelle jamais un Repository directement depuis un Controller.

---

## 5. Le domaine métier

4 entités, toutes autour de la config du Kanban (voir [schema.sql](src/main/resources/schema.sql)) :

| Table | Entité | Rôle |
|-------|--------|------|
| `languages` | `Language` | Langues supportées (fr, mg, en) |
| `kanban_statuses` | `KanbanStatus` | Colonnes du Kanban (NEW, IN_PROGRESS, DONE) |
| `kanban_status_labels` | `KanbanStatusLabel` | Libellé **traduit** d'un statut (i18n) |
| `kanban_status_colors` | `KanbanStatusColor` | Couleur de fond d'un statut |

Relations :
- Un **statut** a plusieurs **labels** (un par langue) → `UNIQUE(status_id, language_id)`
- Un **statut** a une **couleur** → `UNIQUE(status_id)`
- `ON DELETE CASCADE` : supprimer un statut supprime ses labels/couleurs.

---

## 6. Anatomie d'une couche (exemple `KanbanStatus`)

### Entité — [model/KanbanStatus.java](src/main/java/com/glpi/newapp/model/KanbanStatus.java)

```java
@Getter @Setter @NoArgsConstructor   // Lombok : génère getters/setters/constructeur
@Entity                              // = table JPA
@Table(name = "kanban_statuses")
public class KanbanStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // auto-incrément
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "sort_order", nullable = false)       // mapping colonne snake_case
    private Integer sortOrder;

    @Column(name = "is_active", nullable = false)
    private Integer isActive = 1;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist                       // hook : exécuté avant le 1er INSERT
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

> Convention : champ Java **camelCase** (`sortOrder`) ↔ colonne SQL **snake_case** (`sort_order`) via `@Column(name=...)`.

### Repository — [repository/KanbanStatusRepository.java](src/main/java/com/glpi/newapp/repository/KanbanStatusRepository.java)

```java
@Repository
public interface KanbanStatusRepository extends JpaRepository<KanbanStatus, Long> {
    boolean existsByCode(String code);   // requête dérivée du nom de méthode
}
```

`JpaRepository<Entité, TypeDeLId>` fournit gratuitement : `findAll()`, `findById()`, `save()`, `deleteById()`, `count()`… Tu ajoutes seulement tes requêtes spécifiques (ici `existsByCode`, Spring génère le SQL à partir du nom).

### Service — [service/KanbanStatusService.java](src/main/java/com/glpi/newapp/service/KanbanStatusService.java)

```java
@Service
@RequiredArgsConstructor              // Lombok : constructeur pour les champs final
public class KanbanStatusService {

    private final KanbanStatusRepository repository;   // injecté automatiquement

    public List<KanbanStatus> findAll() { return repository.findAll(); }

    public Optional<KanbanStatus> findById(Long id) { return repository.findById(id); }

    public KanbanStatus save(KanbanStatus status) { return repository.save(status); }

    public KanbanStatus update(Long id, KanbanStatus updated) {
        return repository.findById(id).map(status -> {
            status.setCode(updated.getCode());
            status.setSortOrder(updated.getSortOrder());
            status.setIsActive(updated.getIsActive());
            return repository.save(status);
        }).orElseThrow(() -> new RuntimeException("KanbanStatus not found: " + id));
    }

    public void deleteById(Long id) { repository.deleteById(id); }
}
```

> **Injection par constructeur** : `@RequiredArgsConstructor` + champ `final`. Pas de `@Autowired` sur les champs — c'est la pratique recommandée.

### Controller — [controller/KanbanStatusController.java](src/main/java/com/glpi/newapp/controller/KanbanStatusController.java)

```java
@RestController
@RequestMapping("/api/kanban-statuses")   // préfixe de toutes les routes
@RequiredArgsConstructor
public class KanbanStatusController {

    private final KanbanStatusService service;

    @GetMapping                                   // GET /api/kanban-statuses
    public List<KanbanStatus> getAll() { return service.findAll(); }

    @GetMapping("/{id}")                          // GET /api/kanban-statuses/5
    public ResponseEntity<KanbanStatus> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());   // 404 si absent
    }

    @PostMapping                                  // POST (corps JSON → objet)
    public KanbanStatus create(@Valid @RequestBody KanbanStatus status) {
        return service.save(status);
    }

    @PutMapping("/{id}")                          // PUT (mise à jour)
    public ResponseEntity<KanbanStatus> update(@PathVariable Long id,
                                               @Valid @RequestBody KanbanStatus status) {
        try {
            return ResponseEntity.ok(service.update(id, status));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")                        // DELETE → 204 No Content
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
```

| Annotation | Rôle |
|------------|------|
| `@RestController` | Classe qui répond en JSON |
| `@RequestMapping` | Préfixe commun des routes |
| `@GetMapping/@PostMapping/@PutMapping/@DeleteMapping` | Verbe HTTP |
| `@PathVariable` | Variable dans l'URL (`/{id}`) |
| `@RequestBody` | Corps JSON désérialisé en objet Java |
| `@Valid` | Déclenche la validation de l'entité |
| `ResponseEntity` | Permet de contrôler le code HTTP (200, 404, 204…) |

---

## 7. Endpoints REST disponibles

Toutes les ressources suivent le même CRUD. Base : `http://localhost:8080`.

| Méthode | URL | Action |
|---------|-----|--------|
| GET | `/api/kanban-statuses` | Liste les statuts |
| GET | `/api/kanban-statuses/{id}` | Un statut |
| POST | `/api/kanban-statuses` | Crée |
| PUT | `/api/kanban-statuses/{id}` | Modifie |
| DELETE | `/api/kanban-statuses/{id}` | Supprime |

Mêmes routes pour les autres ressources :
- `/api/kanban-status-labels`
- `/api/kanban-status-colors`
- `/api/languages`

(Voir les controllers correspondants ; détails dans [api.md](api.md).)

Exemple `POST` :
```bash
curl -X POST http://localhost:8080/api/kanban-statuses \
  -H "Content-Type: application/json" \
  -d '{"code":"REVIEW","sortOrder":4,"isActive":1}'
```

---

## 8. Ajouter une nouvelle ressource (recette complète)

Pour exposer une nouvelle table en API, créer **4 fichiers** + 1 entrée SQL :

1. **`schema.sql`** — ajouter le `CREATE TABLE` (Hibernate ne le fait pas).
2. **`model/Truc.java`** — l'entité : `@Entity`, `@Table`, `@Id`, `@Column`, Lombok.
3. **`repository/TrucRepository.java`** — `interface ... extends JpaRepository<Truc, Long>`.
4. **`service/TrucService.java`** — `@Service`, `@RequiredArgsConstructor`, méthodes CRUD.
5. **`controller/TrucController.java`** — `@RestController`, `@RequestMapping("/api/trucs")`, les mappings.

Garde exactement les mêmes noms/annotations que `KanbanStatus` pour rester cohérent. Recompile : `mvnw spring-boot:run`.

---

## 9. Base de données SQLite

- Fichier : `newapp.db` à la racine de `newapp/`.
- Schéma : [schema.sql](src/main/resources/schema.sql) (exécuté à chaque démarrage, `CREATE TABLE IF NOT EXISTS`).
- Données initiales : [data.sql](src/main/resources/data.sql).
- Pour repartir de zéro : **supprimer `newapp.db`** puis relancer (le schéma + les seeds se recréent).
- Inspecter la base : outil type *DB Browser for SQLite*, ou `sqlite3 newapp.db`.

> `base.sql` à la racine est une référence de conception ; la source de vérité exécutée est `src/main/resources/schema.sql`.

---

## 10. Pièges & bonnes pratiques

- **camelCase ↔ snake_case** : toujours mapper avec `@Column(name="...")`, sinon Hibernate cherche une colonne mal nommée.
- **`ddl-auto=none`** : modifier une entité ne change PAS la table. Mets à jour `schema.sql` (et supprime `newapp.db` en dev pour reprendre le schéma).
- **Injection par constructeur** (`final` + `@RequiredArgsConstructor`), jamais `@Autowired` sur champ.
- **Validation** : `@Valid` dans le controller + contraintes (`@NotNull`, `@Size`…) sur l'entité pour renvoyer un 400 propre.
- **CORS** : en dev tout passe par le proxy Vite (même origine), donc pas de souci CORS. Si tu appelles le backend directement depuis le navigateur, il faudra ajouter une config CORS (`@CrossOrigin` ou config globale).
- Le backend doit **tourner en parallèle** du front (`npm run dev`).

---

## 11. Fichiers de référence

- Config : [application.properties](src/main/resources/application.properties)
- Schéma BDD : [schema.sql](src/main/resources/schema.sql) · seeds [data.sql](src/main/resources/data.sql)
- Doc API détaillée : [api.md](api.md)
- Aide Spring générée : [HELP.md](HELP.md)
- Exemple complet de stack : `model` / `repository` / `service` / `controller` de `KanbanStatus`
