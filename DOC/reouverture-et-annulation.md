# Réouverture & Annulation d'un ticket clos — Kanban (`/kanban`)

Ce document explique les deux actions proposées quand on **fait glisser un ticket de la colonne « Terminé » vers « In progress »** dans le Kanban : **Annulation** et **Réouverture**. Les deux rouvrent le ticket (statut GLPI → **2 = En cours**) mais traitent le **coût** différemment.

---

## 1. Quand la boîte de dialogue apparaît

Dans [`KanbanBoard.tsx`](../src/components/front/KanbanBoard.tsx), la fonction `deposer()` détecte le cas particulier « on sort de Terminé » :

```ts
if (colId === 'progress' && colonnePourStatut(ticket.status) === 'done') {
  setPendingReopen({ ticketId: id, ancien: ticket.status })
  return
}
```

Au lieu d'appliquer directement le changement de statut, on ouvre la modale `ReopenDialog`, qui propose **deux boutons** :

| Bouton | Sens | Effet sur le coût |
|---|---|---|
| **Annulation** | La clôture était une **erreur** | Supprime le dernier coût fixe saisi |
| **Réouverture** | Réouverture **légitime** | Ajoute un **pourcentage** du dernier coût comme frais |

> Texte affiché dans la modale :
> *« Annulation » rouvre et supprime le coût saisi (clôture erronée). « Réouverture » rouvre et ajoute un pourcentage du dernier coût.*

---

## 2. Annulation (clôture erronée)

Front — `annulerCloture()` :

```ts
await appliquer(ticketId, 2, ancien, () => changerStatutTicket(ticketId, 2)) // statut → En cours
await annulerDernierCoutFixe(ticketId)                                       // retire le dernier coût
```

Appel API : `POST /kanban-api/ticket-fixed-costs/by-ticket/{id}/cancel-last`

Back — `TicketFixedCostService.annulerDernierCout()` :

```java
cible.setCoutFixe(Math.max(0.0, cumul - dernier)); // on soustrait le dernier coût (jamais négatif)
cible.setDernierCout(0.0);                         // plus de "dernier coût" à annuler
```

**Résultat :** le coût fixe manuel cumulé revient à son montant **avant** la clôture. C'est l'option à utiliser quand on a clôturé le ticket par erreur : on « défait » le coût ajouté.

---

## 3. Réouverture (avec frais)

Front — `confirmerReouverture(pourcentage)` :

```ts
await appliquer(ticketId, 2, ancien, () => changerStatutTicket(ticketId, 2)) // statut → En cours
await appliquerReouverture(ticketId, pourcentage)                            // ajoute des frais
```

L'utilisateur saisit un **pourcentage** dans le champ de la modale (ex. `25`).

Appel API : `POST /kanban-api/ticket-fixed-costs/by-ticket/{id}/reopen?pourcentage=25`

Back — `TicketFixedCostService.appliquerReouverture()` :

```java
double base  = cible.getDernierCout();         // le dernier coût saisi
cible.setFraisReouverture(cumul + base * (pourcentage / 100.0));
```

**Formule :**

```
frais ajoutés = dernier_coût × (pourcentage / 100)
frais_reouverture (cumulé) += frais ajoutés
```

**Exemple :** dernier coût = `200`, pourcentage = `25` → frais ajoutés = `200 × 0,25 = 50`. Ces 50 viennent **s'ajouter** à la colonne *Frais réouverture* de la page `/couts`.

> Le coût fixe (`coutFixe`) n'est **pas** modifié par la réouverture : seuls les **frais de réouverture** augmentent. À l'inverse, l'annulation touche `coutFixe` et **pas** les frais.

---

## 4. Données persistées (table SQLite `ticket_fixed_costs`)

Modèle [`TicketFixedCost.java`](../newapp/src/main/java/com/glpi/newapp/model/TicketFixedCost.java) — une ligne **par ticket** :

| Champ | Rôle |
|---|---|
| `cout_fixe` | Cumul des coûts fixes manuels saisis à la clôture |
| `dernier_cout` | Dernier montant saisi (base de calcul de l'annulation et de la réouverture) |
| `frais_reouverture` | Cumul des frais générés par les réouvertures |

C'est `dernier_cout` qui fait le lien entre les trois actions :

- **Clôture** (`add`) : `cout_fixe += montant` ; `dernier_cout = montant`
- **Annulation** (`cancel-last`) : `cout_fixe -= dernier_cout` ; `dernier_cout = 0`
- **Réouverture** (`reopen`) : `frais_reouverture += dernier_cout × %`

---

## 5. Récapitulatif des fonctions séparées

| Fonctionnalité | Front (`KanbanBoard.tsx`) | Service (`coutsApi.ts`) | Endpoint | Service Java |
|---|---|---|---|---|
| Ajouter un coût (clôture) | `confirmerInfo()` | `ajouterCoutFixe()` | `…/add` | `ajouterCout()` |
| Annuler la clôture | `annulerCloture()` | `annulerDernierCoutFixe()` | `…/cancel-last` | `annulerDernierCout()` |
| Rouvrir avec frais | `confirmerReouverture()` | `appliquerReouverture()` | `…/reopen` | `appliquerReouverture()` |

Le **changement de statut** (→ En cours) est commun aux deux actions et passe toujours par `appliquer()` + `changerStatutTicket(id, 2)` ; seul le **traitement du coût** diffère.

---

Voir aussi : [`couts-par-materiel.md`](./couts-par-materiel.md) pour le détail du tableau de coûts.


test