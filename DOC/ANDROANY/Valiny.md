# Valiny — Page d'édition des réouvertures & supercosts (avec recalcul)

> Objectif : une nouvelle page qui **liste tout l'historique** des réouvertures et
> des supercosts (coûts fixes manuels), avec un bouton **Modifier** par ligne.
> - Réouverture → on modifie **pourcentage** + **mode** de calcul.
> - Supercost → on modifie le **montant**.
> - À la validation → **recalcul exact** de tout ce qui dépend de la valeur modifiée.

## Approche retenue : Option A — Ledger (recalcul exact)

La table actuelle `ticket_fixed_costs` ne stocke que des **agrégats par ticket**
(`cout_fixe` cumulé, `pourcentage_reouverture` cumulé, `frais_reouverture` figé…).
Impossible donc de lister/modifier une opération individuelle de façon fiable.

On introduit une **table d'historique** `ticket_cost_events` : 1 ligne par opération
(COST avec un montant, ou REOPEN avec pourcentage + mode), horodatée et **ordonnée**.

- Toute opération (`add`, `reopen`) **ajoute un event** puis **rejoue** tous les
  events du ticket dans l'ordre pour reconstruire la ligne agrégée `ticket_fixed_costs`.
- **Modifier** un event = mettre à jour sa valeur, puis **rejouer** tout le ticket
  → `ticket_fixed_costs` est recalculé exactement et de façon cohérente.

`ticket_fixed_costs` reste la table de lecture (rien à changer côté `coutsApi`/affichage).
`ticket_cost_events` devient la **source de vérité**.

---

## 1. Base de données — nouvelle table

### Fichier : `GLPI_NewApp/newapp/src/main/resources/schema.sql`
À AJOUTER à la fin du fichier (après la table `ticket_refs`, ligne 87) :

```sql
-- ------------------------------------------------------------
-- 7. ticket_cost_events
--    Historique ordonné des opérations de coût d'un ticket.
--    type = 'COST'   -> ajout d'un supercost (champ montant)
--    type = 'REOPEN' -> réouverture (champs pourcentage + mode_calcul)
--    La ligne agrégée ticket_fixed_costs est reconstruite en rejouant
--    ces events dans l'ordre (colonne ordre).
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

## 2. Backend — entité, repository, service, contrôleur

### 2.1 Nouvelle entité
### Fichier à CRÉER : `GLPI_NewApp/newapp/src/main/java/com/glpi/newapp/model/TicketCostEvent.java`

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

    /** Type d'opération tracée dans l'historique. */
    public static final String TYPE_COST = "COST";
    public static final String TYPE_REOPEN = "REOPEN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    /** 'COST' ou 'REOPEN'. */
    @Column(name = "type", nullable = false)
    private String type;

    /** Montant du supercost (type COST). */
    @Column(name = "montant", nullable = false)
    private Double montant = 0.0;

    /** Pourcentage de réouverture (type REOPEN). */
    @Column(name = "pourcentage", nullable = false)
    private Double pourcentage = 0.0;

    /** Mode de calcul de la base de réouverture 1..4 (type REOPEN). */
    @Column(name = "mode_calcul", nullable = false)
    private Integer modeCalcul = 1;

    /** Ordre d'application des events du ticket (croissant). */
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

### 2.2 Nouveau repository
### Fichier à CRÉER : `GLPI_NewApp/newapp/src/main/java/com/glpi/newapp/repository/TicketCostEventRepository.java`

```java
package com.glpi.newapp.repository;

import com.glpi.newapp.model.TicketCostEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketCostEventRepository extends JpaRepository<TicketCostEvent, Long> {

    /** Events d'un ticket dans l'ordre d'application. */
    List<TicketCostEvent> findByTicketIdOrderByOrdreAscIdAsc(Long ticketId);

    /** Tout l'historique, regroupé par ticket puis ordonné. */
    List<TicketCostEvent> findAllByOrderByTicketIdAscOrdreAscIdAsc();

    /** Nombre d'events déjà enregistrés pour un ticket (pour appendre). */
    int countByTicketId(Long ticketId);
}
```

### 2.3 Service — enregistrer les events + recalcul par rejeu
### Fichier à MODIFIER : `GLPI_NewApp/newapp/src/main/java/com/glpi/newapp/service/TicketFixedCostService.java`

Le service garde la même API publique (`ajouterCout`, `annulerDernierCout`,
`appliquerReouverture`) mais **journalise** chaque opération et **reconstruit**
l'agrégat par rejeu. On ajoute une méthode `modifierEvent(...)` pour l'édition.

REMPLACER l'intégralité du contenu de la classe par :

```java
package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketCostEvent;
import com.glpi.newapp.model.TicketFixedCost;
import com.glpi.newapp.repository.TicketCostEventRepository;
import com.glpi.newapp.repository.TicketFixedCostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketFixedCostService {

    private final TicketFixedCostRepository repository;
    private final TicketCostEventRepository eventRepository;

    public List<TicketFixedCost> findAll() {
        return repository.findAll();
    }

    /** Tout l'historique des events (pour la page d'édition). */
    public List<TicketCostEvent> findAllEvents() {
        return eventRepository.findAllByOrderByTicketIdAscOrdreAscIdAsc();
    }

    /** Vide entièrement ticket_fixed_costs + l'historique (purge du reset Tickets). */
    @Transactional
    public void supprimerTout() {
        repository.deleteAllInBatch();
        eventRepository.deleteAllInBatch();
    }

    // ── Opérations publiques : on journalise puis on rejoue ──────────────────

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

    /**
     * Annulation du dernier coût = on supprime le dernier event COST du ticket,
     * puis on rejoue. (Conserve le comportement « annuler le dernier ajout ».)
     */
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

    // ── Édition d'un event existant + recalcul ───────────────────────────────

    /**
     * Modifie un event puis recalcule tout le ticket par rejeu.
     * - COST   : seul `montant` est pris en compte.
     * - REOPEN : seuls `pourcentage` et `modeCalcul` sont pris en compte.
     * Les paramètres null sont ignorés (laissés inchangés).
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

    // ── Reconstruction de l'agrégat par rejeu des events ─────────────────────

    /**
     * Rejoue tous les events du ticket dans l'ordre pour reconstruire la ligne
     * agrégée ticket_fixed_costs. C'est le cœur du recalcul exact.
     */
    @Transactional
    public TicketFixedCost recalculerTicket(Long ticketId) {
        TicketFixedCost cible = repository.findByTicketId(ticketId).orElseGet(() -> {
            TicketFixedCost neuf = new TicketFixedCost();
            neuf.setTicketId(ticketId);
            return neuf;
        });

        // Remise à zéro de l'agrégat avant rejeu.
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

        // Plus aucun event => on supprime la ligne agrégée (cohérence).
        if (events.isEmpty()) {
            if (cible.getId() != null) {
                repository.delete(cible);
            }
            return cible;
        }
        return repository.save(cible);
    }

    /** Applique un ajout de supercost à l'agrégat (logique d'origine de ajouterCout). */
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

    /** Applique une réouverture à l'agrégat (logique d'origine de appliquerReouverture). */
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
}
```

> Note : ce recalcul rejoue la **base au moment de chaque réouverture** dans l'ordre
> exact des events, donc le résultat est cohérent avec l'enchaînement réel des
> opérations (et plus seulement « dernier coût × pourcentage » figé).

### 2.4 Contrôleur — exposer l'historique et l'édition
### Fichier à MODIFIER : `GLPI_NewApp/newapp/src/main/java/com/glpi/newapp/controller/TicketFixedCostController.java`

AJOUTER l'import en tête de fichier :

```java
import com.glpi.newapp.model.TicketCostEvent;
```

AJOUTER ces endpoints dans la classe (après `getAll()` / `deleteAll()`) :

```java
    /** Historique complet des events (réouvertures + supercosts). */
    @GetMapping("/events")
    public List<TicketCostEvent> getAllEvents() {
        return service.findAllEvents();
    }

    /**
     * Modifie un event puis recalcule le ticket.
     * Corps JSON : { "montant": .., "pourcentage": .., "modeCalcul": .. }
     * (champs optionnels selon le type d'event).
     */
    @PutMapping("/events/{eventId}")
    public TicketFixedCost modifierEvent(@PathVariable Long eventId,
                                         @RequestBody ModifierEventRequest corps) {
        return service.modifierEvent(eventId, corps.montant(), corps.pourcentage(), corps.modeCalcul());
    }

    /** Payload d'édition d'un event. Champs null = inchangés. */
    public record ModifierEventRequest(Double montant, Double pourcentage, Integer modeCalcul) {}
```

---

## 3. Frontend — service d'accès aux events

### Fichier à CRÉER : `GLPI_NewApp/src/services/coutEventsApi.ts`

```ts
// Historique des opérations de coût (supercosts + réouvertures), source de
// vérité côté backend. Permet de lister et de modifier une opération ; le
// backend recalcule l'agrégat (ticket_fixed_costs) par rejeu après chaque modif.
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

/** Charge tout l'historique des events, ordonné par ticket puis par ordre. */
export async function chargerEvents(): Promise<CoutEvent[]> {
  const reponse = await fetch(`${BASE}/ticket-fixed-costs/events`, {
    headers: { Accept: 'application/json' },
    // Jamais servi depuis le cache HTTP : on veut l'état recalculé le plus récent.
    cache: 'no-store',
  })
  if (!reponse.ok) return []
  return reponse.json() as Promise<CoutEvent[]>
}

/** Modifie un supercost (montant). Le backend recalcule le ticket. */
export async function modifierSupercost(eventId: number, montant: number): Promise<void> {
  await envoyerModif(eventId, { montant })
}

/** Modifie une réouverture (pourcentage + mode). Le backend recalcule le ticket. */
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

## 4. Frontend — nouvelle page d'édition

### Fichier à CRÉER : `GLPI_NewApp/src/components/front/EditionCoutsPanel.tsx`

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
                  <td>{event.type === 'REOPEN' ? LIBELLES_MODE[event.modeCalcul] ?? event.modeCalcul : '—'}</td>
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
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3>{event.type === 'COST' ? 'Modifier le supercost' : 'Modifier la réouverture'}</h3>

        {event.type === 'COST' ? (
          <>
            <label className="modal-label" htmlFor="edit-montant">Montant</label>
            <input
              id="edit-montant"
              type="number"
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
              value={pourcentage}
              onChange={(champ) => setPourcentage(champ.target.value)}
            />
            <label className="modal-label" htmlFor="edit-mode">Mode de calcul</label>
            <select
              id="edit-mode"
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

## 5. Frontend — route + lien de navigation

### Fichier à MODIFIER : `GLPI_NewApp/src/App.tsx`

AJOUTER l'import (à côté de la ligne 10 `import { CoutsPanel } …`) :

```tsx
import { EditionCoutsPanel } from './components/front/EditionCoutsPanel'
```

AJOUTER la route dans le bloc `<Route element={<FrontLayout />}>` (après la ligne 59
`<Route path="couts" element={<CoutsPanel />} />`) :

```tsx
          <Route path="couts/edition" element={<EditionCoutsPanel />} />
```

### Fichier à MODIFIER : `GLPI_NewApp/src/components/front/FrontLayout.tsx`

AJOUTER l'entrée de menu dans `NAV` (après la ligne 13 `{ id: '/couts', … }`) :

```tsx
  { id: '/couts/edition', label: 'Édition des coûts', icon: 'bi bi-pencil-square', group: 'Tickets' },
```

AJOUTER l'intro de page dans `PAGE_INTRO` (après la ligne 22 `'/couts': { … }`) :

```tsx
  '/couts/edition': { titre: 'Édition des coûts', sous: 'Modifiez une réouverture ou un supercost ; les totaux sont recalculés.' },
```

---

## 6. Amorçage des données existantes (one-shot, optionnel)

Les lignes `ticket_fixed_costs` déjà présentes **n'ont pas d'events** : tant qu'on
ne les modifie pas, elles s'affichent toujours via `coutsApi` (inchangé), mais
elles **n'apparaîtront pas** dans la page d'édition et un recalcul les viderait.

Pour les rendre éditables, amorcer 1 event COST (montant = `cout_fixe`) et, si
`pourcentage_reouverture > 0`, 1 event REOPEN (pourcentage + `mode_reouverture`).
À exécuter une seule fois côté SQLite (base utilisée par le backend) :

```sql
-- 1 event COST par ticket ayant un supercost
INSERT INTO ticket_cost_events (ticket_id, type, montant, pourcentage, mode_calcul, ordre)
SELECT ticket_id, 'COST', cout_fixe, 0, 1, 1
FROM ticket_fixed_costs
WHERE cout_fixe > 0;

-- 1 event REOPEN par ticket ayant une réouverture
INSERT INTO ticket_cost_events (ticket_id, type, montant, pourcentage, mode_calcul, ordre)
SELECT ticket_id, 'REOPEN', 0, pourcentage_reouverture, mode_reouverture, 2
FROM ticket_fixed_costs
WHERE pourcentage_reouverture > 0;
```

> Limite assumée : l'amorçage condense l'historique en **1 seul** COST (le cumul)
> et **1 seul** REOPEN (le pourcentage cumulé). Le détail des ajouts/réouvertures
> antérieurs est perdu (il ne l'était déjà plus), mais le recalcul reste cohérent.
> Tout ce qui est créé **après** ce changement garde son historique fin.

---

## 6 bis. Actualisation de la page « Coûts par matériel »

Objectif : après une modif de réouverture/supercost, la page `/couts` doit afficher
les nouvelles valeurs.

### Pourquoi ça marche automatiquement
- `recalculerTicket()` réécrit `fraisReouverture` (et `coutFixe`) dans
  `ticket_fixed_costs`, **exactement la table lue** par la page Coûts par matériel
  (`coutsApi.chargerCoutsParMateriel`, champ `fraisReouverture` → colonne
  *Frais réouverture* ; `coutFixe` → colonne *Super Coût*).
- `CoutsPanel` recharge ses données à chaque **montage** (`useEffect(..., [])`).
  `/couts/edition` et `/couts` étant deux routes distinctes, revenir sur `/couts`
  remonte le composant → re-fetch → valeurs à jour.

### Garde-fou anti-cache HTTP (recommandé)
### Fichier à MODIFIER : `GLPI_NewApp/src/services/coutsApi.ts`

Ajouter `cache: 'no-store'` aux deux GET de la table des frais, pour ne jamais
afficher une réponse mise en cache par le navigateur après un recalcul.

Ligne 94 (`chargerCoutsParMateriel`) :

```ts
  const manuels = await fetch(`${BASE}/ticket-fixed-costs`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
```

Ligne 150 (`chargerDetailCoutMateriel`) :

```ts
  const manuels = await fetch(`${BASE}/ticket-fixed-costs`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<CoutFixeApi[]>) : []))
```

### Option : rafraîchir sans changer de page
Si tu veux que `/couts` se mette à jour même sans navigation (ex. l'utilisateur
laisse l'onglet ouvert), expose un bouton « Actualiser » qui rappelle le chargement.
### Fichier à MODIFIER : `GLPI_NewApp/src/components/front/CoutsPanel.tsx`

Extraire le chargement dans une fonction réutilisable et l'appeler depuis un bouton :

```tsx
  // Remplace le corps du useEffect : on nomme la fonction pour pouvoir la rappeler.
  const charger = useCallback(() => {
    setEtat('loading')
    chargerCoutsParMateriel()
      .then((donnees) => { setLignes(donnees); setEtat('ready') })
      .catch((e) => { setErreur(e instanceof Error ? e.message : 'Erreur de chargement.'); setEtat('error') })
  }, [])

  useEffect(() => { charger() }, [charger])
```

Puis dans `panel-head`, à côté du titre :

```tsx
        <button type="button" className="btn-ghost" onClick={charger}>
          <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Actualiser
        </button>
```

(Pense à importer `useCallback` depuis `react`.)

---

## 7. Vérifications après mise en place

- Relancer le **backend Spring Boot** (nouvelle table + nouveaux endpoints).
- Vérifier `GET /kanban-api/ticket-fixed-costs/events` → renvoie la liste.
- Page `/couts/edition` : liste visible, bouton **Modifier** par ligne.
- Modifier un supercost → revenir sur `/couts` → la colonne **Super Coût** change.
- Modifier le pourcentage/mode d'une réouverture → revenir sur `/couts` → la colonne
  **Frais réouverture** est recalculée (et le **Total**). Si elle ne bouge pas :
  vérifier que `cache: 'no-store'` est bien posé (§ 6 bis) et que le ticket modifié
  est bien lié à un matériel des `TYPES_MATERIEL` (Computer/Monitor/Phone).
- Reset du module **Tickets** vide aussi `ticket_cost_events` (via `supprimerTout()`).

---

## 8. Récapitulatif des fichiers

| Action | Fichier |
|---|---|
| Modifier | `newapp/src/main/resources/schema.sql` (table `ticket_cost_events`) |
| Créer | `newapp/.../model/TicketCostEvent.java` |
| Créer | `newapp/.../repository/TicketCostEventRepository.java` |
| Modifier | `newapp/.../service/TicketFixedCostService.java` (journalisation + rejeu) |
| Modifier | `newapp/.../controller/TicketFixedCostController.java` (endpoints events) |
| Créer | `src/services/coutEventsApi.ts` |
| Modifier | `src/services/coutsApi.ts` (ajout `cache: 'no-store'`, § 6 bis) |
| Créer | `src/components/front/EditionCoutsPanel.tsx` |
| Modifier | `src/App.tsx` (route `/couts/edition`) |
| Modifier | `src/components/front/FrontLayout.tsx` (lien + intro) |
