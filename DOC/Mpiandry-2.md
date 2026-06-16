# Mode de calcul du pourcentage de réouverture

## Objectif

Ajouter un **mode de calcul** qui détermine la **base** sur laquelle s'applique le
pourcentage de réouverture. La base est aujourd'hui figée sur le **dernier coût**.

| mode | base appliquée                         | exemple (coûts 50 puis 100) |
|------|----------------------------------------|-----------------------------|
| 1    | dernier coût                           | 100                         |
| 2    | premier coût                           | 50                          |
| 3    | moyenne de tous les coûts              | 75                          |
| 4    | somme (total) de tous les coûts        | 150                         |

Frais de réouverture = `base × pourcentage / 100`.
Exemple mode 3 avec 10 % : `75 × 10 / 100 = 7,5`.

Points d'ajout :
- **Kanban** : zone de liste (1/2/3/4) à côté du champ pourcentage.
- **Import CSV** : dernière colonne `mode`, lue uniquement sur les lignes `reopened`.

> Tout le travail reste dans `GLPI_NewApp` (front React + backend `newapp`). Aucune
> modification du cœur GLPI.

---

## 1. Backend Java — base de données

### 1.1 Fichier : `newapp/src/main/resources/schema.sql`

Le moteur est SQLite avec `ddl-auto=none` : le schéma vient de ce fichier.
Remplacer la définition actuelle de `ticket_fixed_costs` (lignes **62 à 71**) par :

```sql
CREATE TABLE IF NOT EXISTS ticket_fixed_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL UNIQUE,
    cout_fixe REAL NOT NULL DEFAULT 0,
    pourcentage_reouverture REAL NOT NULL DEFAULT 0,
    base_reouverture REAL NOT NULL DEFAULT 0,
    frais_reouverture REAL NOT NULL DEFAULT 0,
    dernier_cout REAL NOT NULL DEFAULT 0,
    premier_cout REAL NOT NULL DEFAULT 0,
    nombre_couts INTEGER NOT NULL DEFAULT 0,
    mode_reouverture INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Base déjà existante — migration

`CREATE TABLE IF NOT EXISTS` n'ajoute pas les colonnes à une base déjà créée.
Exécuter une seule fois sur la base SQLite existante (`newapp.db`) :

```sql
ALTER TABLE ticket_fixed_costs ADD COLUMN premier_cout REAL NOT NULL DEFAULT 0;
ALTER TABLE ticket_fixed_costs ADD COLUMN nombre_couts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_fixed_costs ADD COLUMN mode_reouverture INTEGER NOT NULL DEFAULT 1;
```

---

## 2. Backend Java — entité

### Fichier : `newapp/src/main/java/com/glpi/newapp/model/TicketFixedCost.java`

Après le champ `dernierCout` (ligne **42**, juste avant `@Column(name = "created_at")`),
ajouter :

```java
    @Column(name = "premier_cout", nullable = false)
    private Double premierCout = 0.0;

    @Column(name = "nombre_couts", nullable = false)
    private Integer nombreCouts = 0;

    /** Dernier mode de calcul utilisé pour la réouverture (1 à 4). Informatif. */
    @Column(name = "mode_reouverture", nullable = false)
    private Integer modeReouverture = 1;
```

---

## 3. Backend Java — service

### Fichier : `newapp/src/main/java/com/glpi/newapp/service/TicketFixedCostService.java`

### 3.1 `ajouterCout` — mémoriser premier coût et compteur

Remplacer la méthode `ajouterCout` (lignes **29 à 36**) par :

```java
    @Transactional
    public TicketFixedCost ajouterCout(Long ticketId, double montant) {
        TicketFixedCost cible = trouverOuCreer(ticketId);
        double cumul = cible.getCoutFixe() == null ? 0.0 : cible.getCoutFixe();
        int nombreCouts = cible.getNombreCouts() == null ? 0 : cible.getNombreCouts();
        if (nombreCouts == 0) {
            cible.setPremierCout(montant);
        }
        cible.setCoutFixe(cumul + montant);
        cible.setDernierCout(montant);
        cible.setNombreCouts(nombreCouts + 1);
        return repository.save(cible);
    }
```

### 3.2 `annulerDernierCout` — décrémenter le compteur

Remplacer la méthode `annulerDernierCout` (lignes **38 à 49**) par :

```java
    @Transactional
    public TicketFixedCost annulerDernierCout(Long ticketId) {
        TicketFixedCost cible = repository.findByTicketId(ticketId).orElse(null);
        if (cible == null) {
            return null;
        }
        double cumul = cible.getCoutFixe() == null ? 0.0 : cible.getCoutFixe();
        double dernier = cible.getDernierCout() == null ? 0.0 : cible.getDernierCout();
        int nombreCouts = cible.getNombreCouts() == null ? 0 : cible.getNombreCouts();
        cible.setCoutFixe(Math.max(0.0, cumul - dernier));
        cible.setDernierCout(0.0);
        cible.setNombreCouts(Math.max(0, nombreCouts - 1));
        if (cible.getNombreCouts() == 0) {
            cible.setPremierCout(0.0);
        }
        return repository.save(cible);
    }
```

### 3.3 `appliquerReouverture` — choisir la base selon le mode

Remplacer la méthode `appliquerReouverture` (lignes **51 à 68**) par :

```java
    @Transactional
    public TicketFixedCost appliquerReouverture(Long ticketId, double pourcentage, int modeCalcul) {
        TicketFixedCost cible = trouverOuCreer(ticketId);
        double cumulPct = cible.getPourcentageReouverture() == null ? 0.0 : cible.getPourcentageReouverture();
        cible.setPourcentageReouverture(cumulPct + pourcentage);
        cible.setModeReouverture(modeCalcul);

        // Base selon le mode de calcul :
        //   1 = dernier coût | 2 = premier coût | 3 = moyenne | 4 = somme (total)
        double base = calculerBase(cible, modeCalcul);
        cible.setBaseReouverture(base); // dernière base, informatif

        // Frais de réouverture FIGÉ et CUMULÉ : calculé au moment de la réouverture
        // (base × pourcentage) et ajouté au cumul. Jamais supprimé ni recalculé.
        double fraisAjout = base * (pourcentage / 100.0);
        double fraisCumul = cible.getFraisReouverture() == null ? 0.0 : cible.getFraisReouverture();
        cible.setFraisReouverture(fraisCumul + fraisAjout);

        return repository.save(cible);
    }

    /** Calcule la base de réouverture selon le mode (1 à 4). */
    private double calculerBase(TicketFixedCost cible, int modeCalcul) {
        double dernierCout = cible.getDernierCout() == null ? 0.0 : cible.getDernierCout();
        double premierCout = cible.getPremierCout() == null ? 0.0 : cible.getPremierCout();
        double sommeCouts = cible.getCoutFixe() == null ? 0.0 : cible.getCoutFixe();
        int nombreCouts = cible.getNombreCouts() == null ? 0 : cible.getNombreCouts();
        switch (modeCalcul) {
            case 2:
                return premierCout;
            case 3:
                return nombreCouts > 0 ? sommeCouts / nombreCouts : 0.0;
            case 4:
                return sommeCouts;
            case 1:
            default:
                return dernierCout;
        }
    }
```

---

## 4. Backend Java — contrôleur

### Fichier : `newapp/src/main/java/com/glpi/newapp/controller/TicketFixedCostController.java`

Remplacer la méthode `reopen` (lignes **32 à 35**) par :

```java
    @PostMapping("/by-ticket/{ticketId}/reopen")
    public TicketFixedCost reopen(@PathVariable Long ticketId,
                                  @RequestParam double pourcentage,
                                  @RequestParam(defaultValue = "1") int modeCalcul) {
        return service.appliquerReouverture(ticketId, pourcentage, modeCalcul);
    }
```

---

## 5. Front — service des coûts

### Fichier : `src/services/coutsApi.ts`

Remplacer la fonction `appliquerReouverture` (lignes **67 à 69**) par :

```ts
export async function appliquerReouverture(
  ticketId: number,
  pourcentage: number,
  modeCalcul = 1,
): Promise<void> {
  await postCout(
    `${BASE}/ticket-fixed-costs/by-ticket/${ticketId}/reopen?pourcentage=${pourcentage}&modeCalcul=${modeCalcul}`,
  )
}
```

---

## 6. Front — import CSV des mouvements

### Fichier : `src/services/importMvtApi.ts`

### 6.1 Type `LigneImport` — ajouter le mode

Dans l'interface `LigneImport` (lignes **17 à 23**), ajouter le champ `modeCalcul`
après `valeur` :

```ts
export interface LigneImport {
  numLigne: number
  /** Ref_Ticket (1-based) tel que saisi dans le CSV — résolu plus tard en id GLPI. */
  ref: number
  mvt: MvtType
  valeur: string
  /** Mode de calcul de la base de réouverture (1 à 4). Lu uniquement si mvt = reopened. */
  modeCalcul: number
}
```

### 6.2 `parserImportMvt` — lire la 4e colonne

Dans `parserImportMvt`, remplacer le corps de la boucle `for` (lignes **65 à 74**) par :

```ts
  for (const { numLigne, valeurs } of lignes) {
    const ref = Number((valeurs[0] ?? '').trim())
    const mvt = normaliserMvt(valeurs[1] ?? '')
    const valeur = (valeurs[2] ?? '').trim()
    // 4e colonne « mode » : prise en compte uniquement pour une réouverture.
    const modeBrut = Number((valeurs[3] ?? '').trim())
    const modeCalcul = mvt === 'reopened' && [1, 2, 3, 4].includes(modeBrut) ? modeBrut : 1
    if (!ref || !mvt) {
      erreurs.push({ numLigne, ticket: ref, mvt: valeurs[1] ?? '', ok: false, message: 'Ref ou mouvement invalide' })
      continue
    }
    ok.push({ numLigne, ref, mvt, valeur, modeCalcul })
  }
```

### 6.3 `appliquerLigne` — transmettre le mode

Dans `appliquerLigne`, remplacer l'appel de réouverture (ligne **90**) :

```ts
      await appliquerReouverture(ticketId, Number(l.valeur) || 0)
```

par :

```ts
      await appliquerReouverture(ticketId, Number(l.valeur) || 0, l.modeCalcul)
```

### 6.4 Format CSV attendu

Le CSV passe de 3 à 4 colonnes : `ticket, mvt, valeur, mode`.
La colonne `mode` n'est renseignée que sur les lignes `reopened` (valeur 1, 2, 3 ou 4) ;
ailleurs elle est ignorée (défaut 1).

Exemple :

```csv
1,reopened,10,3
2,close,150,
3,cancel,,
```

---

## 7. Front — Kanban (zone de liste dans la modale)

### Fichier : `src/components/front/KanbanBoard.tsx`

### 7.1 `confirmerReouverture` — accepter le mode

Remplacer la fonction `confirmerReouverture` (lignes **189 à 199**) par :

```tsx
  async function confirmerReouverture(pourcentage: number, modeCalcul: number) {
    if (!pendingReopen) return
    const { ticketId, ancien } = pendingReopen
    setPendingReopen(null)
    await appliquer(ticketId, 2, ancien, () => changerStatutTicket(ticketId, 2))
    try {
      await appliquerReouverture(ticketId, pourcentage, modeCalcul)
    } catch {
      void 0
    }
  }
```

### 7.2 `ReopenDialog` — signature + zone de liste

Remplacer le composant `ReopenDialog` (lignes **471 à 502**) par :

```tsx
function ReopenDialog({ onCancel, onAnnuler, onReouvrir }: {
  onCancel: () => void
  onAnnuler: () => void | Promise<void>
  onReouvrir: (pourcentage: number, modeCalcul: number) => void | Promise<void>
}) {
  const [pourcentage, setPourcentage] = useState('')
  const [modeCalcul, setModeCalcul] = useState(1)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Rouvrir le ticket</h3>
        <p className="modal-hint">« Annulation » rouvre et supprime le coût saisi (clôture erronée). « Réouverture » rouvre et ajoute un pourcentage de la base choisie.</p>
        <label className="modal-label" htmlFor="kanban-reopen-pct">Pourcentage (%)</label>
        <input
          id="kanban-reopen-pct"
          type="number"
          min="0"
          step="0.1"
          className="modal-input"
          value={pourcentage}
          onChange={(e) => setPourcentage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          placeholder="0"
        />
        <label className="modal-label" htmlFor="kanban-reopen-mode">Mode de calcul</label>
        <select
          id="kanban-reopen-mode"
          className="modal-input"
          value={modeCalcul}
          onChange={(e) => setModeCalcul(Number(e.target.value))}
        >
          <option value={1}>1 — Dernier coût</option>
          <option value={2}>2 — Premier coût</option>
          <option value={3}>3 — Moyenne des coûts</option>
          <option value={4}>4 — Somme (total) des coûts</option>
        </select>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onAnnuler}>Annulation</button>
          <button type="button" className="btn-primary" onClick={() => onReouvrir(Number(pourcentage) || 0, modeCalcul)}>Réouverture</button>
        </div>
      </div>
    </div>
  )
}
```

> L'appel `<ReopenDialog ... onReouvrir={confirmerReouverture} />` (lignes **260 à 266**)
> reste inchangé : la nouvelle signature à deux arguments est déjà compatible.

---

## 8. Front — texte d'aide de l'import

### Fichier : `src/components/front/ImportMvtPanel.tsx`

Remplacer le paragraphe d'explication (lignes **46 à 52**) par :

```tsx
      <p className="muted">
        Colonnes attendues : <code>ticket, mvt, valeur, mode</code>. La colonne <code>ticket</code> est le{' '}
        <strong>Ref_Ticket</strong> (la même référence que la Feuille 2 d'import des tickets).
        Mouvements acceptés :{' '}
        <code>reopened</code> (valeur = % à appliquer, <code>mode</code> = 1 dernier / 2 premier / 3 moyenne / 4 somme),{' '}
        <code>cancel</code>/<code>annuler</code> (valeur ignorée),{' '}
        <code>close</code>/<code>terminer</code> (valeur = coût fixe en €).
      </p>
```

---

## Récapitulatif des fichiers

| # | Fichier | Action |
|---|---------|--------|
| 1 | `newapp/src/main/resources/schema.sql` | Ajouter 3 colonnes à `ticket_fixed_costs` |
| 1.2 | base SQLite `newapp.db` | `ALTER TABLE` (migration unique) |
| 2 | `model/TicketFixedCost.java` | Champs `premierCout`, `nombreCouts`, `modeReouverture` |
| 3 | `service/TicketFixedCostService.java` | `ajouterCout`, `annulerDernierCout`, `appliquerReouverture` + `calculerBase` |
| 4 | `controller/TicketFixedCostController.java` | Param `modeCalcul` sur `reopen` |
| 5 | `src/services/coutsApi.ts` | Param `modeCalcul` |
| 6 | `src/services/importMvtApi.ts` | 4e colonne `mode` |
| 7 | `src/components/front/KanbanBoard.tsx` | Zone de liste + transmission du mode |
| 8 | `src/components/front/ImportMvtPanel.tsx` | Texte d'aide |

**Aucun nouveau fichier à créer** — toutes les modifications portent sur des fichiers existants.
