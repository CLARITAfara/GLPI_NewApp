# Fichiers modifiés — Mode de calcul du pourcentage de réouverture

Copies complètes (stockage seul) des fichiers modifiés pour la fonctionnalité
« mode de calcul de la base de réouverture » (modes 1 à 4).
Ces copies ne sont pas utilisées par l'application : elles servent uniquement
d'archive du code modifié.

| Copie ici | Fichier réel modifié |
|-----------|----------------------|
| `schema.sql` | `newapp/src/main/resources/schema.sql` |
| `TicketFixedCost.java` | `newapp/src/main/java/com/glpi/newapp/model/TicketFixedCost.java` |
| `TicketFixedCostService.java` | `newapp/src/main/java/com/glpi/newapp/service/TicketFixedCostService.java` |
| `TicketFixedCostController.java` | `newapp/src/main/java/com/glpi/newapp/controller/TicketFixedCostController.java` |
| `coutsApi.ts` | `src/services/coutsApi.ts` |
| `importMvtApi.ts` | `src/services/importMvtApi.ts` |
| `KanbanBoard.tsx` | `src/components/front/KanbanBoard.tsx` |
| `ImportMvtPanel.tsx` | `src/components/front/ImportMvtPanel.tsx` |

## Modes de calcul

| mode | base appliquée |
|------|----------------|
| 1 | dernier coût |
| 2 | premier coût |
| 3 | moyenne de tous les coûts |
| 4 | somme (total) de tous les coûts |

## Migration base existante

`schema.sql` ne modifie pas une base SQLite déjà créée. Exécuter une fois sur `newapp.db` :

```sql
ALTER TABLE ticket_fixed_costs ADD COLUMN premier_cout REAL NOT NULL DEFAULT 0;
ALTER TABLE ticket_fixed_costs ADD COLUMN nombre_couts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_fixed_costs ADD COLUMN mode_reouverture INTEGER NOT NULL DEFAULT 1;
```
