# Affichage — Liste des mouvements annulés + Rétablir

> Périmètre de ce md : **partie A (affichage)**. On ajoute sur la page Édition des
> coûts un **2ᵉ tableau** listant les mouvements **annulés**, avec un bouton
> **Rétablir** qui remet l'event à sa place d'origine (même `ordre`), recalcule, et
> reclôture le ticket. Le plafond de réouverture fera l'objet d'un md séparé.
>
> Mécanique : l'annulation devient un **soft-delete** (`annule = true`) au lieu d'une
> suppression. Le rejeu ignore les events annulés ; Rétablir repasse `annule = false`.
> Comme l'event garde son `ordre`, il revient exactement à son rang.
>
> Numéros de ligne = état **actuel** des fichiers (après la feature Édition).

---

## 1. `newapp/src/main/resources/schema.sql` — MODIFIER

Table `ticket_cost_events` (lignes 97-106). AJOUTER la colonne `annule` **après la
ligne 104** (`ordre INTEGER NOT NULL, ...`), avant `created_at` :

```sql
    annule      INTEGER NOT NULL DEFAULT 0,        -- 0 = actif, 1 = annule (soft-delete)
```

Pour une base **déjà créée** (la table existe → le CREATE ne s'applique pas), exécuter
une fois en plus :

```sql
ALTER TABLE ticket_cost_events ADD COLUMN annule INTEGER NOT NULL DEFAULT 0;
```

---

## 2. `newapp/.../model/TicketCostEvent.java` — MODIFIER

AJOUTER le champ `annule` **après la ligne 46** (champ `ordre`), avant `createdAt`
(ligne 48) :

```java
    /** Soft-delete : true = mouvement annule (ignore au rejeu, listable / retablissable). */
    @Column(name = "annule", nullable = false)
    private Boolean annule = false;
```

---

## 3. `newapp/.../service/TicketFixedCostService.java` — MODIFIER

### 3.1 `annulerDernierCout` — soft-delete au lieu de suppression

Le `dernierCout` doit viser le dernier COST **non annulé** : REMPLACER la ligne 70
`if (TicketCostEvent.TYPE_COST.equals(e.getType())) {` par :

```java
            if (TicketCostEvent.TYPE_COST.equals(e.getType()) && !Boolean.TRUE.equals(e.getAnnule())) {
```

Puis REMPLACER les lignes 74-76 :

```java
        if (dernierCout != null) {
            eventRepository.delete(dernierCout);
        }
```

par :

```java
        if (dernierCout != null) {
            dernierCout.setAnnule(true);
            eventRepository.save(dernierCout);
        }
```

### 3.2 `recalculerTicket` — ignorer les events annulés

REMPLACER la ligne 135 `for (TicketCostEvent e : events) {` par un saut des annulés :

```java
        for (TicketCostEvent e : events) {
            if (Boolean.TRUE.equals(e.getAnnule())) {
                continue;
            }
```

Pour la suppression de l'agrégat quand il ne reste **aucun event actif**, REMPLACER
la ligne 144 `if (events.isEmpty()) {` par :

```java
        boolean aucunActif = events.stream().noneMatch(e -> !Boolean.TRUE.equals(e.getAnnule()));
        if (aucunActif) {
```

### 3.3 `restaurerEvent` — NOUVELLE méthode

AJOUTER après `modifierEvent(...)` (après la ligne 108) :

```java
    /** Retablit un mouvement annule (annule = false) puis recalcule le ticket. */
    @Transactional
    public TicketFixedCost restaurerEvent(Long eventId) {
        TicketCostEvent event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return null;
        }
        event.setAnnule(false);
        eventRepository.save(event);
        return recalculerTicket(event.getTicketId());
    }
```

---

## 4. `newapp/.../controller/TicketFixedCostController.java` — MODIFIER

AJOUTER l'endpoint de restauration **après la ligne 46** (la `record
ModifierEventRequest`) :

```java
    /** Retablit un mouvement annule puis recalcule le ticket. */
    @PostMapping("/events/{eventId}/restore")
    public TicketFixedCost restaurerEvent(@PathVariable Long eventId) {
        return service.restaurerEvent(eventId);
    }
```

---

## 5. `src/services/coutEventsApi.ts` — MODIFIER

### 5.1 Champ `annule` dans l'interface

AJOUTER **après la ligne 16** (`createdAt: string`), dans `interface CoutEvent` :

```ts
  annule: boolean
```

### 5.2 Fonction `restaurerEvent`

AJOUTER après la fonction `modifierReouverture` (après la ligne 42) :

```ts
/** Retablit un mouvement annule. Le backend recalcule le ticket. */
export async function restaurerEvent(eventId: number): Promise<void> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events/${eventId}/restore`, {
    method: 'POST',
  })
  if (!reponse.ok) throw new Error(`kanban-api ${reponse.status}`)
}
```

---

## 6. `src/components/front/EditionCoutsPanel.tsx` — MODIFIER

### 6.1 Imports

REMPLACER les lignes 2-6 (import depuis `coutEventsApi`) pour ajouter
`restaurerEvent` :

```tsx
import {
  chargerEvents,
  modifierReouverture,
  modifierSupercost,
  restaurerEvent,
} from '../../services/coutEventsApi'
```

REMPLACER la ligne 8 (`import { listerTicketsFront } ...`) pour ajouter
`changerStatutTicket` (reclôture du ticket après rétablissement) :

```tsx
import { listerTicketsFront, changerStatutTicket } from '../../services/ticketsFrontApi'
```

### 6.2 Séparer events actifs / annulés + handler Rétablir

AJOUTER, juste après la fonction `valider` (après la ligne 65), dans le composant :

```tsx
  // 6 = statut « Clos » (Terminé) : retablir une annulation reclot le ticket.
  const STATUT_TERMINE = 6

  const actifs = events.filter((event) => !event.annule)
  const annules = events.filter((event) => event.annule)

  async function retablir(event: CoutEvent) {
    setEnregistrement(true)
    try {
      await restaurerEvent(event.id)
      // L'etat « Termine » revient : on referme le ticket cote GLPI (best-effort).
      try {
        await changerStatutTicket(event.ticketId, STATUT_TERMINE)
      } catch {
        /* best-effort : le recalcul des couts a deja eu lieu */
      }
      await recharger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Échec du rétablissement.')
    } finally {
      setEnregistrement(false)
    }
  }
```

### 6.3 Le tableau principal n'affiche que les actifs

REMPLACER la ligne 91 (`{events.map((event) => (`) par :

```tsx
              {actifs.map((event) => (
```

REMPLACER les lignes 106-108 (le cas liste vide) par :

```tsx
              {actifs.length === 0 && (
                <tr><td colSpan={7} className="muted">Aucune opération active.</td></tr>
              )}
```

### 6.4 Nouveau tableau « Mouvements annulés »

AJOUTER **après la ligne 112** (la fermeture `</div>` du `table-scroll` du tableau
principal, juste avant le bloc `{edition && (` ligne 114) :

```tsx
      {etat === 'ready' && annules.length > 0 && (
        <div className="table-scroll" style={{ marginTop: '1.5rem' }}>
          <h3 className="modal-title"><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Mouvements annulés</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Pourcentage</th>
                <th>Mode</th>
                <th>Ordre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {annules.map((event) => (
                <tr key={event.id}>
                  <td>#{event.ticketId}{nomsParTicket.get(event.ticketId) ? ` — ${nomsParTicket.get(event.ticketId)}` : ''}</td>
                  <td>{event.type === 'COST' ? 'Supercost' : 'Réouverture'}</td>
                  <td>{event.type === 'COST' ? formatMontant(event.montant) : '—'}</td>
                  <td>{event.type === 'REOPEN' ? `${event.pourcentage} %` : '—'}</td>
                  <td>{event.type === 'REOPEN' ? (LIBELLES_MODE[event.modeCalcul] ?? '—') : '—'}</td>
                  <td>{event.ordre}</td>
                  <td>
                    <button type="button" className="btn-ghost" disabled={enregistrement} onClick={() => retablir(event)}>
                      <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Rétablir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
```

---

## 7. Récapitulatif des fichiers

| Action | Fichier | Repère |
|---|---|---|
| Modifier | `schema.sql` | colonne `annule` après L104 (+ ALTER si base existante) |
| Modifier | `TicketCostEvent.java` | champ `annule` après L46 |
| Modifier | `TicketFixedCostService.java` | L70, L74-76, L135, L144 + nouvelle méthode après L108 |
| Modifier | `TicketFixedCostController.java` | endpoint restore après L46 |
| Modifier | `coutEventsApi.ts` | `annule` après L16, `restaurerEvent` après L42 |
| Modifier | `EditionCoutsPanel.tsx` | imports L2-6 et L8 ; logique après L65 ; L91 ; L106-108 ; 2ᵉ tableau après L112 |

## 8. Vérifications

- Relancer le backend (colonne `annule` + endpoint restore).
- Annuler un coût (cancel Kanban/CSV) → le mouvement quitte le tableau actif et
  apparaît dans **Mouvements annulés**.
- Cliquer **Rétablir** → l'event revient **au même rang** (même `ordre`), les coûts
  sont recalculés, et le ticket repasse en **Terminé**.
- Une base déjà peuplée nécessite l'`ALTER TABLE` du § 1.
