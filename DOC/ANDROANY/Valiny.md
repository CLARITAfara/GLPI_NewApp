# Valiny — Page d'édition des réouvertures & supercosts (avec recalcul)

> Etat : **implémenté**. Ce document ne liste que les **portions à modifier** par
> fichier (et le contenu des fichiers réellement **nouveaux**).
>
> Principe : la table `ticket_fixed_costs` (agrégat par ticket) reste la table de
> lecture. On ajoute une table d'historique **`ticket_cost_events`** (1 ligne par
> opération, ordonnée) qui devient la source de vérité. Chaque opération journalise
> un event puis **rejoue** tous les events du ticket pour reconstruire l'agrégat.
> Modifier un event = update + rejeu → recalcul exact.

---

## 1. `newapp/src/main/resources/schema.sql` — MODIFIER

AJOUTER après la table `ticket_refs` :

```sql
-- ------------------------------------------------------------
-- 7. ticket_cost_events
--    Historique ordonne des operations de cout d'un ticket.
--    type = 'COST'   -> ajout d'un supercost (champ montant)
--    type = 'REOPEN' -> reouverture (champs pourcentage + mode_calcul)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_cost_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id   INTEGER NOT NULL,
    type        TEXT    NOT NULL,                 -- 'COST' | 'REOPEN'
    montant     REAL    NOT NULL DEFAULT 0,       -- pour COST
    pourcentage REAL    NOT NULL DEFAULT 0,       -- pour REOPEN
    mode_calcul INTEGER NOT NULL DEFAULT 1,       -- pour REOPEN (1..4)
    ordre       INTEGER NOT NULL,                 -- ordre d'application
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. `newapp/.../model/TicketCostEvent.java` — CRÉER (fichier neuf)

```java
package com.glpi.newapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ticket_cost_events")
public class TicketCostEvent {

    public static final String TYPE_COST = "COST";
    public static final String TYPE_REOPEN = "REOPEN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "montant", nullable = false)
    private Double montant = 0.0;

    @Column(name = "pourcentage", nullable = false)
    private Double pourcentage = 0.0;

    @Column(name = "mode_calcul", nullable = false)
    private Integer modeCalcul = 1;

    @Column(name = "ordre", nullable = false)
    private Integer ordre = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

---

## 3. `newapp/.../repository/TicketCostEventRepository.java` — CRÉER (fichier neuf)

```java
package com.glpi.newapp.repository;

import com.glpi.newapp.model.TicketCostEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketCostEventRepository extends JpaRepository<TicketCostEvent, Long> {

    List<TicketCostEvent> findByTicketIdOrderByOrdreAscIdAsc(Long ticketId);

    List<TicketCostEvent> findAllByOrderByTicketIdAscOrdreAscIdAsc();

    int countByTicketId(Long ticketId);
}
```

---

## 4. `newapp/.../service/TicketFixedCostService.java` — MODIFIER

### 4.1 Imports — AJOUTER

```java
import com.glpi.newapp.model.TicketCostEvent;
import com.glpi.newapp.repository.TicketCostEventRepository;
```

### 4.2 Champ injecté — AJOUTER sous `repository`

```java
    private final TicketCostEventRepository eventRepository;
```

### 4.3 `supprimerTout()` — REMPLACER (vide aussi l'historique)

```java
    /** Vide entierement ticket_fixed_costs + l'historique (purge du reset Tickets). */
    @Transactional
    public void supprimerTout() {
        repository.deleteAllInBatch();
        eventRepository.deleteAllInBatch();
    }
```

### 4.4 `ajouterCout` / `appliquerReouverture` / `annulerDernierCout` — REMPLACER

Ces 3 méthodes journalisent désormais un event puis rejouent. La méthode privée
`trouverOuCreer` n'est plus utilisée : la supprimer.

```java
    @Transactional
    public TicketFixedCost ajouterCout(Long ticketId, double montant) {
        TicketCostEvent event = new TicketCostEvent();
        event.setTicketId(ticketId);
        event.setType(TicketCostEvent.TYPE_COST);
        event.setMontant(montant);
        event.setOrdre(eventRepository.countByTicketId(ticketId) + 1);
        eventRepository.save(event);
        return recalculerTicket(ticketId);
    }

    @Transactional
    public TicketFixedCost appliquerReouverture(Long ticketId, double pourcentage, int modeCalcul) {
        TicketCostEvent event = new TicketCostEvent();
        event.setTicketId(ticketId);
        event.setType(TicketCostEvent.TYPE_REOPEN);
        event.setPourcentage(pourcentage);
        event.setModeCalcul(modeCalcul);
        event.setOrdre(eventRepository.countByTicketId(ticketId) + 1);
        eventRepository.save(event);
        return recalculerTicket(ticketId);
    }

    @Transactional
    public TicketFixedCost annulerDernierCout(Long ticketId) {
        List<TicketCostEvent> events = eventRepository.findByTicketIdOrderByOrdreAscIdAsc(ticketId);
        TicketCostEvent dernierCout = null;
        for (TicketCostEvent e : events) {
            if (TicketCostEvent.TYPE_COST.equals(e.getType())) {
                dernierCout = e;
            }
        }
        if (dernierCout != null) {
            eventRepository.delete(dernierCout);
        }
        return recalculerTicket(ticketId);
    }
```

### 4.5 Méthodes nouvelles — AJOUTER

```java
    /** Tout l'historique des events (pour la page d'edition). */
    public List<TicketCostEvent> findAllEvents() {
        return eventRepository.findAllByOrderByTicketIdAscOrdreAscIdAsc();
    }

    /**
     * Modifie un event puis recalcule tout le ticket par rejeu.
     * - COST   : seul montant est pris en compte.
     * - REOPEN : seuls pourcentage et modeCalcul sont pris en compte.
     */
    @Transactional
    public TicketFixedCost modifierEvent(Long eventId, Double montant, Double pourcentage, Integer modeCalcul) {
        TicketCostEvent event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return null;
        }
        if (TicketCostEvent.TYPE_COST.equals(event.getType())) {
            if (montant != null) {
                event.setMontant(montant);
            }
        } else {
            if (pourcentage != null) {
                event.setPourcentage(pourcentage);
            }
            if (modeCalcul != null) {
                event.setModeCalcul(modeCalcul);
            }
        }
        eventRepository.save(event);
        return recalculerTicket(event.getTicketId());
    }

    /** Rejoue tous les events du ticket dans l'ordre pour reconstruire l'agregat. */
    @Transactional
    public TicketFixedCost recalculerTicket(Long ticketId) {
        TicketFixedCost cible = repository.findByTicketId(ticketId).orElseGet(() -> {
            TicketFixedCost neuf = new TicketFixedCost();
            neuf.setTicketId(ticketId);
            return neuf;
        });

        cible.setCoutFixe(0.0);
        cible.setPremierCout(0.0);
        cible.setDernierCout(0.0);
        cible.setNombreCouts(0);
        cible.setPourcentageReouverture(0.0);
        cible.setBaseReouverture(0.0);
        cible.setFraisReouverture(0.0);
        cible.setModeReouverture(1);

        List<TicketCostEvent> events = eventRepository.findByTicketIdOrderByOrdreAscIdAsc(ticketId);
        for (TicketCostEvent e : events) {
            if (TicketCostEvent.TYPE_COST.equals(e.getType())) {
                appliquerCout(cible, e.getMontant());
            } else {
                appliquerReopen(cible, e.getPourcentage(), e.getModeCalcul());
            }
        }

        if (events.isEmpty()) {
            if (cible.getId() != null) {
                repository.delete(cible);
            }
            return cible;
        }
        return repository.save(cible);
    }

    private void appliquerCout(TicketFixedCost cible, double montant) {
        int nombreCouts = cible.getNombreCouts() == null ? 0 : cible.getNombreCouts();
        if (nombreCouts == 0) {
            cible.setPremierCout(montant);
        }
        double cumul = cible.getCoutFixe() == null ? 0.0 : cible.getCoutFixe();
        cible.setCoutFixe(cumul + montant);
        cible.setDernierCout(montant);
        cible.setNombreCouts(nombreCouts + 1);
    }

    private void appliquerReopen(TicketFixedCost cible, double pourcentage, int modeCalcul) {
        double cumulPct = cible.getPourcentageReouverture() == null ? 0.0 : cible.getPourcentageReouverture();
        cible.setPourcentageReouverture(cumulPct + pourcentage);
        cible.setModeReouverture(modeCalcul);

        double base = calculerBase(cible, modeCalcul);
        cible.setBaseReouverture(base);

        double fraisAjout = base * (pourcentage / 100.0);
        double fraisCumul = cible.getFraisReouverture() == null ? 0.0 : cible.getFraisReouverture();
        cible.setFraisReouverture(fraisCumul + fraisAjout);
    }
```

> `calculerBase(...)` reste **inchangée**.

---

## 5. `newapp/.../controller/TicketFixedCostController.java` — MODIFIER

### 5.1 Import — AJOUTER

```java
import com.glpi.newapp.model.TicketCostEvent;
```

### 5.2 Endpoints — AJOUTER après `deleteAll()`

```java
    /** Historique complet des events (reouvertures + supercosts). */
    @GetMapping("/events")
    public List<TicketCostEvent> getAllEvents() {
        return service.findAllEvents();
    }

    /** Modifie un event puis recalcule le ticket. */
    @PutMapping("/events/{eventId}")
    public TicketFixedCost modifierEvent(@PathVariable Long eventId,
                                         @RequestBody ModifierEventRequest corps) {
        return service.modifierEvent(eventId, corps.montant(), corps.pourcentage(), corps.modeCalcul());
    }

    /** Payload d'edition d'un event. Champs null = inchanges. */
    public record ModifierEventRequest(Double montant, Double pourcentage, Integer modeCalcul) {}
```

---

## 6. `src/services/coutEventsApi.ts` — CRÉER (fichier neuf)

```ts
const BASE = '/kanban-api'

export type TypeEvent = 'COST' | 'REOPEN'

export interface CoutEvent {
  id: number
  ticketId: number
  type: TypeEvent
  montant: number
  pourcentage: number
  modeCalcul: number
  ordre: number
  createdAt: string
}

export async function chargerEvents(): Promise<CoutEvent[]> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!reponse.ok) return []
  return reponse.json() as Promise<CoutEvent[]>
}

export async function modifierSupercost(eventId: number, montant: number): Promise<void> {
  await envoyerModif(eventId, { montant })
}

export async function modifierReouverture(
  eventId: number,
  pourcentage: number,
  modeCalcul: number,
): Promise<void> {
  await envoyerModif(eventId, { pourcentage, modeCalcul })
}

async function envoyerModif(
  eventId: number,
  corps: { montant?: number; pourcentage?: number; modeCalcul?: number },
): Promise<void> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!reponse.ok) throw new Error(`kanban-api ${reponse.status}`)
}
```

---

## 7. `src/components/front/EditionCoutsPanel.tsx` — CRÉER (fichier neuf)

Page liste + modale d'édition. Points clés du style : la modale utilise les classes
réellement stylées (`modal-card`, `modal-title`, `modal-input`) — fond **opaque** —
et la colonne Mode n'affiche que des libellés (jamais le numéro).

```tsx
import { useEffect, useState } from 'react'
import {
  chargerEvents,
  modifierReouverture,
  modifierSupercost,
} from '../../services/coutEventsApi'
import type { CoutEvent } from '../../services/coutEventsApi'

type Etat = 'loading' | 'ready' | 'error'

const LIBELLES_MODE: Record<number, string> = {
  1: 'Dernier coût',
  2: 'Premier coût',
  3: 'Moyenne',
  4: 'Somme',
}

function formatMontant(valeur: number): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function EditionCoutsPanel() {
  const [events, setEvents] = useState<CoutEvent[]>([])
  const [etat, setEtat] = useState<Etat>('loading')
  const [erreur, setErreur] = useState('')
  const [edition, setEdition] = useState<CoutEvent | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  async function recharger() {
    setEtat('loading')
    setErreur('')
    try {
      setEvents(await chargerEvents())
      setEtat('ready')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de chargement.')
      setEtat('error')
    }
  }

  useEffect(() => {
    void recharger()
  }, [])

  async function valider(valeurs: { montant?: number; pourcentage?: number; modeCalcul?: number }) {
    if (!edition) return
    setEnregistrement(true)
    try {
      if (edition.type === 'COST') {
        await modifierSupercost(edition.id, valeurs.montant ?? 0)
      } else {
        await modifierReouverture(edition.id, valeurs.pourcentage ?? 0, valeurs.modeCalcul ?? 1)
      }
      setEdition(null)
      await recharger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.")
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><i className="bi bi-pencil-square" aria-hidden="true" /> Édition des coûts</h2>
      </div>

      {etat === 'loading' && <p className="muted">Chargement en cours…</p>}
      {etat === 'error' && <p className="login-error" role="alert">{erreur}</p>}

      {etat === 'ready' && (
        <div className="table-scroll">
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
              {events.map((event) => (
                <tr key={event.id}>
                  <td>#{event.ticketId}</td>
                  <td>{event.type === 'COST' ? 'Supercost' : 'Réouverture'}</td>
                  <td>{event.type === 'COST' ? formatMontant(event.montant) : '—'}</td>
                  <td>{event.type === 'REOPEN' ? `${event.pourcentage} %` : '—'}</td>
                  <td>{event.type === 'REOPEN' ? (LIBELLES_MODE[event.modeCalcul] ?? '—') : '—'}</td>
                  <td>{event.ordre}</td>
                  <td>
                    <button type="button" className="btn-ghost" onClick={() => setEdition(event)}>
                      <i className="bi bi-pencil" aria-hidden="true" /> Modifier
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={7} className="muted">Aucune opération enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {edition && (
        <EditionDialog
          event={edition}
          enregistrement={enregistrement}
          onAnnuler={() => setEdition(null)}
          onValider={valider}
        />
      )}
    </section>
  )
}

function EditionDialog({
  event,
  enregistrement,
  onAnnuler,
  onValider,
}: {
  event: CoutEvent
  enregistrement: boolean
  onAnnuler: () => void
  onValider: (valeurs: { montant?: number; pourcentage?: number; modeCalcul?: number }) => void
}) {
  const [montant, setMontant] = useState(String(event.montant))
  const [pourcentage, setPourcentage] = useState(String(event.pourcentage))
  const [modeCalcul, setModeCalcul] = useState(event.modeCalcul)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onAnnuler}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{event.type === 'COST' ? 'Modifier le supercost' : 'Modifier la réouverture'}</h3>

        {event.type === 'COST' ? (
          <>
            <label className="modal-label" htmlFor="edit-montant">Montant</label>
            <input
              id="edit-montant"
              type="number"
              className="modal-input"
              value={montant}
              onChange={(champ) => setMontant(champ.target.value)}
            />
          </>
        ) : (
          <>
            <label className="modal-label" htmlFor="edit-pct">Pourcentage (%)</label>
            <input
              id="edit-pct"
              type="number"
              className="modal-input"
              value={pourcentage}
              onChange={(champ) => setPourcentage(champ.target.value)}
            />
            <label className="modal-label" htmlFor="edit-mode">Mode de calcul</label>
            <select
              id="edit-mode"
              className="modal-input"
              value={modeCalcul}
              onChange={(champ) => setModeCalcul(Number(champ.target.value))}
            >
              <option value={1}>Dernier coût</option>
              <option value={2}>Premier coût</option>
              <option value={3}>Moyenne</option>
              <option value={4}>Somme</option>
            </select>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onAnnuler} disabled={enregistrement}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={enregistrement}
            onClick={() =>
              onValider(
                event.type === 'COST'
                  ? { montant: Number(montant) || 0 }
                  : { pourcentage: Number(pourcentage) || 0, modeCalcul },
              )
            }
          >
            {enregistrement ? 'Recalcul…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 8. `src/App.tsx` — MODIFIER

AJOUTER l'import (à côté de `CoutsPanel`) :

```tsx
import { EditionCoutsPanel } from './components/front/EditionCoutsPanel'
```

AJOUTER la route après `<Route path="couts" element={<CoutsPanel />} />` :

```tsx
          <Route path="couts/edition" element={<EditionCoutsPanel />} />
```

---

## 9. `src/components/front/FrontLayout.tsx` — MODIFIER

AJOUTER dans `NAV`, après l'entrée `/couts` :

```tsx
  { id: '/couts/edition', label: 'Édition des coûts', icon: 'bi bi-pencil-square', group: 'Tickets' },
```

AJOUTER dans `PAGE_INTRO`, après l'entrée `'/couts'` :

```tsx
  '/couts/edition': { titre: 'Édition des coûts', sous: 'Modifiez une réouverture ou un supercost ; les totaux sont recalculés.' },
```

---

## 10. `src/services/coutsApi.ts` — MODIFIER (anti-cache après recalcul)

Sur les **deux** GET de `ticket-fixed-costs` (dans `chargerCoutsParMateriel` et
`chargerDetailCoutMateriel`), ajouter `cache: 'no-store'` :

```ts
  const manuels = await fetch(`${BASE}/ticket-fixed-costs`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
```

---

## 11. Amorçage des données existantes (one-shot, optionnel)

Les lignes `ticket_fixed_costs` déjà présentes n'ont pas d'events : elles n'apparaissent
pas dans la page d'édition tant qu'on ne les amorce pas. À exécuter **une fois** sur la
base SQLite du backend :

```sql
INSERT INTO ticket_cost_events (ticket_id, type, montant, pourcentage, mode_calcul, ordre)
SELECT ticket_id, 'COST', cout_fixe, 0, 1, 1
FROM ticket_fixed_costs
WHERE cout_fixe > 0;

INSERT INTO ticket_cost_events (ticket_id, type, montant, pourcentage, mode_calcul, ordre)
SELECT ticket_id, 'REOPEN', 0, pourcentage_reouverture, mode_reouverture, 2
FROM ticket_fixed_costs
WHERE pourcentage_reouverture > 0;
```

---

## 12. Récapitulatif des fichiers

| Action | Fichier |
|---|---|
| Modifier | `newapp/src/main/resources/schema.sql` |
| Créer | `newapp/.../model/TicketCostEvent.java` |
| Créer | `newapp/.../repository/TicketCostEventRepository.java` |
| Modifier | `newapp/.../service/TicketFixedCostService.java` |
| Modifier | `newapp/.../controller/TicketFixedCostController.java` |
| Créer | `src/services/coutEventsApi.ts` |
| Créer | `src/components/front/EditionCoutsPanel.tsx` |
| Modifier | `src/App.tsx` |
| Modifier | `src/components/front/FrontLayout.tsx` |
| Modifier | `src/services/coutsApi.ts` |

## 13. Vérifications

- Relancer le backend Spring Boot (nouvelle table + endpoints).
- `GET /kanban-api/ticket-fixed-costs/events` renvoie la liste.
- `/couts/edition` : liste + bouton Modifier ; modale à fond opaque.
- Modifier un supercost/réouverture → revenir sur `/couts` → colonnes recalculées.
- Reset du module Tickets vide aussi `ticket_cost_events` (via `supprimerTout()`).
