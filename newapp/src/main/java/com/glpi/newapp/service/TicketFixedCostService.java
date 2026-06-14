package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketFixedCost;
import com.glpi.newapp.repository.TicketFixedCostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketFixedCostService {

    private final TicketFixedCostRepository repository;

    public List<TicketFixedCost> findAll() {
        return repository.findAll();
    }

    private TicketFixedCost trouverOuCreer(Long ticketId) {
        return repository.findByTicketId(ticketId).orElseGet(() -> {
            TicketFixedCost neuf = new TicketFixedCost();
            neuf.setTicketId(ticketId);
            return neuf;
        });
    }

    @Transactional
    public TicketFixedCost ajouterCout(Long ticketId, double montant) {
        TicketFixedCost cible = trouverOuCreer(ticketId);
        double cumul = cible.getCoutFixe() == null ? 0.0 : cible.getCoutFixe();
        cible.setCoutFixe(cumul + montant);
        cible.setDernierCout(montant);
        return repository.save(cible);
    }

    @Transactional
    public TicketFixedCost annulerDernierCout(Long ticketId) {
        TicketFixedCost cible = repository.findByTicketId(ticketId).orElse(null);
        if (cible == null) {
            return null;
        }
        double cumul = cible.getCoutFixe() == null ? 0.0 : cible.getCoutFixe();
        double dernier = cible.getDernierCout() == null ? 0.0 : cible.getDernierCout();
        cible.setCoutFixe(Math.max(0.0, cumul - dernier));
        cible.setDernierCout(0.0);
        return repository.save(cible);
    }

    @Transactional
    public TicketFixedCost appliquerReouverture(Long ticketId, double pourcentage) {
        TicketFixedCost cible = trouverOuCreer(ticketId);
        double cumul = cible.getPourcentageReouverture() == null ? 0.0 : cible.getPourcentageReouverture();
        cible.setPourcentageReouverture(cumul + pourcentage);
        // On fige la base de calcul (dernier coût au moment de la réouverture) :
        // ainsi les frais survivent à une annulation ultérieure, qui ne supprime
        // QUE le dernier coût (remise à 0 de dernier_cout) sans toucher cette base.
        double base = cible.getDernierCout() == null ? 0.0 : cible.getDernierCout();
        if (base > 0) {
            cible.setBaseReouverture(base);
        }
        return repository.save(cible);
    }
}
