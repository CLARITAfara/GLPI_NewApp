package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketCostEvent;
import com.glpi.newapp.model.TicketFixedCost;
import com.glpi.newapp.repository.AppSettingRepository;
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
    private final AppSettingRepository appSettingRepository;

    public List<TicketFixedCost> findAll() {
        return repository.findAll();
    }

    /** Tout l'historique des events (pour la page d'edition). */
    public List<TicketCostEvent> findAllEvents() {
        return eventRepository.findAllByOrderByTicketIdAscOrdreAscIdAsc();
    }

    /** Vide entierement ticket_fixed_costs + l'historique (purge du reset Tickets). */
    @Transactional
    public void supprimerTout() {
        repository.deleteAllInBatch();
        eventRepository.deleteAllInBatch();
    }

    // -- Operations publiques : on journalise puis on rejoue --------------------

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
     * Annulation du dernier cout = on supprime le dernier event COST du ticket,
     * puis on rejoue. (Conserve le comportement "annuler le dernier ajout".)
     */
    @Transactional
    public TicketFixedCost annulerDernierCout(Long ticketId) {
        List<TicketCostEvent> events = eventRepository.findByTicketIdOrderByOrdreAscIdAsc(ticketId);
        TicketCostEvent dernierCout = null;
        for (TicketCostEvent e : events) {
            if (TicketCostEvent.TYPE_COST.equals(e.getType()) && !Boolean.TRUE.equals(e.getAnnule())) {
                dernierCout = e;
            }
        }
        if (dernierCout != null) {
            dernierCout.setAnnule(true);
            eventRepository.save(dernierCout);
        }
        return recalculerTicket(ticketId);
    }

    // -- Edition d'un event existant + recalcul ---------------------------------

    /**
     * Modifie un event puis recalcule tout le ticket par rejeu.
     * - COST   : seul montant est pris en compte.
     * - REOPEN : seuls pourcentage et modeCalcul sont pris en compte.
     * Les parametres null sont ignores (laisses inchanges).
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

    // -- Reconstruction de l'agregat par rejeu des events -----------------------

    /**
     * Rejoue tous les events du ticket dans l'ordre pour reconstruire la ligne
     * agregee ticket_fixed_costs. C'est le coeur du recalcul exact.
     */
    @Transactional
    public TicketFixedCost recalculerTicket(Long ticketId) {
        TicketFixedCost cible = repository.findByTicketId(ticketId).orElseGet(() -> {
            TicketFixedCost neuf = new TicketFixedCost();
            neuf.setTicketId(ticketId);
            return neuf;
        });

        // Remise a zero de l'agregat avant rejeu.
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
            if (Boolean.TRUE.equals(e.getAnnule())) {
                continue;
            }
            if (TicketCostEvent.TYPE_COST.equals(e.getType())) {
                appliquerCout(cible, e.getMontant());
            } else {
                appliquerReopen(cible, e.getPourcentage(), e.getModeCalcul());
            }
        }

        // Plafond de reouverture : le total des frais ne depasse pas
        // (plafond % du supercost). Applique au recalcul -> retroactif.
        Double plafond = lirePlafondReouverture();
        if (plafond != null) {
            double cap = (plafond / 100.0) * cible.getCoutFixe();
            if (cible.getFraisReouverture() > cap) {
                cible.setFraisReouverture(cap);
            }
        }

        // Plus aucun event actif => on supprime la ligne agregee (coherence).
        boolean aucunActif = events.stream().noneMatch(e -> !Boolean.TRUE.equals(e.getAnnule()));
        if (aucunActif) {
            if (cible.getId() != null) {
                repository.delete(cible);
            }
            return cible;
        }
        return repository.save(cible);
    }

    /** Applique un ajout de supercost a l'agregat (logique d'origine de ajouterCout). */
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

    /** Applique une reouverture a l'agregat (logique d'origine de appliquerReouverture). */
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

    /**
     * Plafond de reouverture en % (parametre global 'plafond_reouverture').
     * null = aucun plafond defini (pas de blocage).
     */
    private Double lirePlafondReouverture() {
        return appSettingRepository.findById("plafond_reouverture")
                .map(s -> {
                    try {
                        return Double.parseDouble(s.getValeur());
                    } catch (NumberFormatException e) {
                        return null;
                    }
                })
                .orElse(null);
    }

    /** Calcule la base de reouverture selon le mode (1 a 4). */
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
