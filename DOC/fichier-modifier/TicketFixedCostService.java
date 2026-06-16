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
        int nombreCouts = cible.getNombreCouts() == null ? 0 : cible.getNombreCouts();
        if (nombreCouts == 0) {
            cible.setPremierCout(montant);
        }
        cible.setCoutFixe(cumul + montant);
        cible.setDernierCout(montant);
        cible.setNombreCouts(nombreCouts + 1);
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
        int nombreCouts = cible.getNombreCouts() == null ? 0 : cible.getNombreCouts();
        cible.setCoutFixe(Math.max(0.0, cumul - dernier));
        cible.setDernierCout(0.0);
        cible.setNombreCouts(Math.max(0, nombreCouts - 1));
        if (cible.getNombreCouts() == 0) {
            cible.setPremierCout(0.0);
        }
        return repository.save(cible);
    }

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
        // (base × pourcentage) et ajouté au cumul. Jamais supprimé ni recalculé —
        // une annulation ultérieure ne touche que coutFixe/dernierCout.
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
}
