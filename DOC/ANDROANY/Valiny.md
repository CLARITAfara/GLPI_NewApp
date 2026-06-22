# Valiny — Plafond de réouverture (partie B)

> Ce qui manquait à la fonctionnalité : le **plafond de réouverture**. C'est la
> partie B (la partie A — liste des mouvements annulés + Rétablir — est dans
> `Affichage.md`).
>
> **Règle métier.** Paramètre **global**, stocké dans **SQLite**, **sans interface**
> (on le change directement en base). Il borne le **coût total de réouverture** d'un
> ticket à un **pourcentage du supercost** :
>
> ```
> cap = (plafond / 100) * supercost (cout_fixe)
> si frais_reouverture_total > cap  ->  frais_reouverture_total = cap
> ```
>
> Exemple : supercost = 100, plafond = 20 % → frais de réouverture plafonnés à **20**.
> Le calcul de réouverture et les modes **ne changent pas** ; on **bloque** seulement
> si le total dépasse le plafond. Appliqué **au recalcul** (`recalculerTicket`), donc
> **rétroactif** : changer le plafond re-plafonne tous les tickets au prochain rejeu.
>
> Numéros de ligne = état **actuel** des fichiers.

---

## 1. `newapp/src/main/resources/schema.sql` — MODIFIER

AJOUTER **à la fin du fichier** (après la table `ticket_cost_events`, ligne 106) :

```sql
-- ------------------------------------------------------------
-- 8. app_settings
--    Paramètres généraux de l'application (clé / valeur).
--    Utilisé pour 'plafond_reouverture' : plafond (en %) du coût de réouverture
--    par rapport au supercost. Pas d'interface : modifiable directement en base.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    cle    TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
);
```

---

## 2. `newapp/src/main/resources/data.sql` — MODIFIER

AJOUTER **après la ligne 17** (dernière ligne `INSERT ... kanban_status_labels`) la
valeur par défaut du plafond (20 %). `INSERT OR IGNORE` = idempotent, ne réécrase pas
une valeur déjà fixée :

```sql

-- app_settings : plafond de reouverture par defaut (en %)
INSERT OR IGNORE INTO app_settings (cle, valeur) VALUES ('plafond_reouverture', '20');
```

> Pour changer le plafond ensuite (sans interface), en base :
> `UPDATE app_settings SET valeur = '30' WHERE cle = 'plafond_reouverture';`
> Pour une base **déjà créée**, exécuter une fois le `CREATE TABLE` du § 1 puis cet
> `INSERT`.

---

## 3. `newapp/.../model/AppSetting.java` — CRÉER (fichier neuf)

```java
package com.glpi.newapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "app_settings")
public class AppSetting {

    @Id
    @Column(name = "cle")
    private String cle;

    @Column(name = "valeur", nullable = false)
    private String valeur;
}
```

---

## 4. `newapp/.../repository/AppSettingRepository.java` — CRÉER (fichier neuf)

```java
package com.glpi.newapp.repository;

import com.glpi.newapp.model.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
}
```

---

## 5. `newapp/.../service/TicketFixedCostService.java` — MODIFIER

### 5.1 Import — AJOUTER avec les autres imports `repository`

```java
import com.glpi.newapp.repository.AppSettingRepository;
```

### 5.2 Champ injecté — AJOUTER après la ligne 17 (`private final TicketCostEventRepository eventRepository;`)

```java
    private final AppSettingRepository appSettingRepository;
```

### 5.3 Clamp du plafond dans `recalculerTicket`

La boucle de rejeu se termine ligne 141 ; le test de suppression de l'agrégat est
ligne 144. AJOUTER le plafonnement **entre les deux** (après la ligne 141,
avant la ligne 143/144) :

```java
        // Plafond de reouverture : le total des frais ne depasse pas
        // (plafond % du supercost). Applique au recalcul -> retroactif.
        Double plafond = lirePlafondReouverture();
        if (plafond != null) {
            double cap = (plafond / 100.0) * cible.getCoutFixe();
            if (cible.getFraisReouverture() > cap) {
                cible.setFraisReouverture(cap);
            }
        }
```

### 5.4 Lecture du plafond — NOUVELLE méthode privée

AJOUTER (par ex. juste avant `calculerBase`) :

```java
    /**
     * Plafond de reouverture en % (parametre global 'plafond_reouverture').
     * null = aucun plafond defini (pas de blocage).
     */
    private Double lirePlafondReouverture() {
        return appSettingRepository.findById("plafond_reouverture")
                .map(s -> {
                    try {
                        return Double.parseDouble(s.getValeur());
                    } catch (NumberFormatException e) {
                        return null;
                    }
                })
                .orElse(null);
    }
```

---

## 6. Récapitulatif des fichiers

| Action | Fichier | Repère |
|---|---|---|
| Modifier | `schema.sql` | table `app_settings` après L106 (+ CREATE si base existante) |
| Modifier | `data.sql` | seed `plafond_reouverture` après L17 |
| Créer | `newapp/.../model/AppSetting.java` | — |
| Créer | `newapp/.../repository/AppSettingRepository.java` | — |
| Modifier | `TicketFixedCostService.java` | import ; champ après L17 ; clamp après L141 ; méthode `lirePlafondReouverture` avant `calculerBase` |

## 7. Vérifications

- Relancer le backend (nouvelle table + seed).
- Plafond 20 %, ticket avec supercost 100 et une réouverture calculée à 35 →
  `frais_reouverture` plafonné à **20** ; à 15 → reste **15**.
- `UPDATE app_settings SET valeur='40' ...` puis déclencher un recalcul (modifier /
  rétablir un event du ticket) → le plafond effectif suit (rétroactif).
- Sans ligne `plafond_reouverture` en base → aucun blocage (comportement d'avant).

## 8. Lien avec la partie A

Le clamp s'appuie sur `cout_fixe` et `frais_reouverture` reconstruits par
`recalculerTicket`, qui (cf. `Affichage.md`) ignore déjà les events annulés. Les deux
parties sont donc cohérentes : un mouvement annulé ne compte ni dans le supercost ni
dans les frais, et le plafond se recalcule en conséquence.
