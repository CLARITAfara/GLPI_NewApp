# Coûts par matériel — `src/services/coutsApi.ts`

Fichier qui calcule les coûts affichés sur la page `/couts`. C'est lui qui produit les totaux (ex. **410,45**).

## Rôle

Agréger, **par type de matériel** (PC, Moniteur, Téléphone), les coûts des tickets auxquels ces matériels sont liés.

## Sources de données

| Donnée | Origine | Lecture |
|---|---|---|
| Liens matériel ↔ ticket | GLPI `Item_Ticket` | API legacy `getSousItemsLegacy('Ticket', id, 'Item_Ticket')` |
| Coûts importés (CSV) | GLPI `TicketCost` (`glpi_ticketcosts`) | API legacy `getSousItemsLegacy('Ticket', id, 'TicketCost')` |
| Coût fixe manuel | SQLite `ticket_fixed_costs` | `GET /kanban-api/ticket-fixed-costs` |

## Colonnes GLPI utilisées (`glpi_ticketcosts`)

- `cost_fixed` → **Coût import** (coût fixe du CSV)
- `actiontime` (durée en **secondes**) + `cost_time` (**tarif horaire**) → **Coût temps**
- `cost_fixe` (table SQLite) → **Coût manuel**

## Formules

```
coût import   = Σ cost_fixed
coût temps    = Σ ( actiontime / 3600 × cost_time )
coût manuel   = cout_fixe (SQLite, par ticket)
```

### Répartition par matériel

Si un ticket a **N matériels liés**, chaque coût du ticket est divisé par N et la part est attribuée à chaque matériel selon son type :

```
part = coût_du_ticket / nombre_de_matériels_liés
```

### Exemple (coût temps)

```
actiontime = 600 s   cost_time = 8,7 /h
coût temps = 600 / 3600 × 8,7 = 1,45
```

## Totaux affichés sur `/couts`

- **Total fixe** = `coût import + coût manuel` (sans le temps)
- **Total** = `coût import + coût temps + coût manuel`

## Fonctions exportées

- `TYPES_MATERIEL` — mapping itemtype GLPI → libellé (`Computer`→PC, `Monitor`→Moniteur, `Phone`→Téléphone)
- `enregistrerCoutFixe(ticketId, coutFixe)` — `POST` du coût manuel dans SQLite (appelé à la clôture d'un ticket dans le Kanban)
- `chargerCoutsParMateriel()` — retourne `CoutMateriel[]` (`libelle`, `coutImport`, `coutTime`, `coutManuel`) ; 6 tickets traités en parallèle (`pool`)

## Prérequis

- Jeton legacy `VITE_GLPI_USER_TOKEN` configuré (lecture `Item_Ticket` et `TicketCost`), sinon totaux à 0.
- Backend Spring Boot démarré (table `ticket_fixed_costs` créée via `schema.sql`).
