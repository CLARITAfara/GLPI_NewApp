# Calcul du tableau « Coûts par matériel » — page `/couts`

Ce document explique **comment chaque colonne du tableau** de la page `/couts` est calculée, et **quelles fonctionnalités sont séparées** (sources, formules, répartition).

Fichiers concernés :
- Affichage : [`CoutsPanel.tsx`](../src/components/front/CoutsPanel.tsx)
- Calcul : [`coutsApi.ts`](../src/services/coutsApi.ts) → `chargerCoutsParMateriel()`

---

## 1. But du tableau

Agréger les coûts des tickets **par type de matériel** (PC, Moniteur, Téléphone), pas par ticket. Un ticket peut être lié à plusieurs matériels : son coût est alors **réparti** entre eux.

Mapping des types (`TYPES_MATERIEL`) :

| `itemtype` GLPI | Libellé affiché |
|---|---|
| `Computer` | PC |
| `Monitor` | Moniteur |
| `Phone` | Téléphone |

---

## 2. Les colonnes du tableau

| Colonne | Champ interne | Origine | Calcul |
|---|---|---|---|
| **Coût import (GLPI)** | `coutImport` | GLPI `TicketCost.cost_fixed` | `Σ cost_fixed` |
| **Coût temps (GLPI)** | `coutTime` | GLPI `TicketCost.actiontime` + `cost_time` | `Σ (actiontime / 3600 × cost_time)` |
| **Super Coût** | `coutManuel` | SQLite `ticket_fixed_costs.cout_fixe` | coût fixe manuel saisi à la clôture |
| **Frais réouverture** | `coutReouverture` | SQLite `ticket_fixed_costs.frais_reouverture` | frais cumulés des réouvertures |
| **Total fixe** | — | calcul d'affichage | `coutImport + coutManuel + coutReouverture` |
| **Total** | — | calcul d'affichage | `coutImport + coutTime + coutManuel + coutReouverture` |

> **Total fixe** = tout sauf le temps. **Total** = tout, temps compris.

---

## 3. Les trois sources de données (séparées)

Le calcul croise **trois origines distinctes** :

| Source | Donnée | Lecture |
|---|---|---|
| GLPI `Item_Ticket` | Liens matériel ↔ ticket | `getSousItemsLegacy('Ticket', id, 'Item_Ticket')` |
| GLPI `TicketCost` (`glpi_ticketcosts`) | Coûts importés (CSV) : `cost_fixed`, `actiontime`, `cost_time` | `getSousItemsLegacy('Ticket', id, 'TicketCost')` |
| SQLite `ticket_fixed_costs` | Coût manuel + frais réouverture | `GET /kanban-api/ticket-fixed-costs` |

Les deux premières viennent de **l'API legacy GLPI** ; la troisième de **l'app Spring Boot** (alimentée par les actions du Kanban : clôture, annulation, réouverture).

---

## 4. Algorithme de `chargerCoutsParMateriel()`

```text
1. Charger tous les coûts manuels SQLite → 2 Maps par ticketId :
     coutManuelParTicket       (cout_fixe)
     coutReouvertureParTicket  (frais_reouverture)

2. Lister tous les tickets (front).

3. Pour chaque ticket (6 en parallèle via pool) :
     a. Récupérer les matériels liés (Item_Ticket). Si 0 → ignorer le ticket.
     b. Récupérer les TicketCost du ticket :
          coutImportTicket = Σ cost_fixed
          coutTimeTicket   = Σ (actiontime / 3600 × cost_time)
     c. N = nombre de matériels liés
        Répartir chaque coût en parts égales :
          partImport      = coutImportTicket / N
          partTime        = coutTimeTicket   / N
          partManuel      = cout_fixe(ticket)        / N
          partReouverture = frais_reouverture(ticket) / N
     d. Pour chaque matériel lié, ajouter sa part au total de son type.

4. Retourner un CoutMateriel par type (PC / Moniteur / Téléphone).
```

### Pourquoi diviser par N (répartition)

Un coût appartient au **ticket**, pas au matériel. Si un ticket touche 1 PC + 1 Moniteur (`N = 2`), chacun reçoit la **moitié** de chaque coût du ticket. Cela évite de compter deux fois le même coût.

```
part = coût_du_ticket / nombre_de_matériels_liés
```

---

## 5. Exemples de calcul

**Coût temps** d'un `TicketCost` :
```
actiontime = 600 s   cost_time = 8,70 €/h
coût temps = 600 / 3600 × 8,70 = 1,45 €
```

**Répartition** (`N = 2` matériels) d'un ticket à 200 € de coût manuel :
```
partManuel = 200 / 2 = 100 € → +100 € sur le PC, +100 € sur le Moniteur
```

---

## 6. Totaux (pied de tableau)

Calculés côté React dans `CoutsPanel.tsx` par simple somme des lignes :

```ts
totalImport      = Σ coutImport
totalTime        = Σ coutTime
totalManuel      = Σ coutManuel
totalReouverture = Σ coutReouverture
// puis Total fixe / Total combinés comme pour chaque ligne
```

---

## 7. Lien avec le Kanban (alimentation des colonnes SQLite)

Les colonnes **Super Coût** et **Frais réouverture** ne sont jamais saisies sur `/couts` : elles sont remplies par les actions du Kanban.

| Colonne `/couts` | Action Kanban qui l'alimente |
|---|---|
| Super Coût (`cout_fixe`) | Clôture avec coût fixe ; réduite par **Annulation** |
| Frais réouverture (`frais_reouverture`) | **Réouverture** avec pourcentage |

Détail de ces actions : voir [`reouverture-et-annulation.md`](./reouverture-et-annulation.md).

---

## 8. Prérequis

- Jeton legacy `VITE_GLPI_USER_TOKEN` configuré (lecture `Item_Ticket` et `TicketCost`), sinon colonnes GLPI à 0.
- Backend Spring Boot démarré (table `ticket_fixed_costs` créée via `schema.sql`), sinon Super Coût / Frais réouverture à 0.
