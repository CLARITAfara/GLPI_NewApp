package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketCostEvent;
import com.glpi.newapp.model.TicketFixedCost;
import com.glpi.newapp.repository.AppSettingRepository;
import com.glpi.newapp.repository.TicketCostEventRepository;
import com.glpi.newapp.repository.TicketFixedCostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
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
    public List<TicketFixedCost> ajouterCout(Long ticketId, double montant) {
        TicketCostEvent event = new TicketCostEvent();
        event.setTicketId(ticketId);
        event.setType(TicketCostEvent.TYPE_COST);
        event.setMontant(montant);
        event.setOrdre(eventRepository.countByTicketId(ticketId) + 1);
        eventRepository.save(event);
        return recalculerTicket(ticketId);
    }

    @Transactional
    public List<TicketFixedCost> appliquerReouverture(Long ticketId, double pourcentage, int modeCalcul) {
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
    public List<TicketFixedCost> annulerDernierCout(Long ticketId) {
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
    public List<TicketFixedCost> modifierEvent(Long eventId, Double montant, Double pourcentage, Integer modeCalcul) {
        TicketCostEvent event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return List.of();
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
    public List<TicketFixedCost> restaurerEvent(Long eventId) {
        TicketCostEvent event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return List.of();
        }
        event.setAnnule(false);
        eventRepository.save(event);
        return recalculerTicket(event.getTicketId());
    }

    // -- Reconstruction du journal par rejeu des events -------------------------

    /**
     * Rejoue tous les events actifs du ticket dans l'ordre et reconstruit le
     * journal ticket_fixed_costs : UNE LIGNE PAR OPERATION.
     *
     * Chaque ligne REOPEN fige sa base / son frais a partir des couts deja
     * inseres AVANT elle. Un cout posterieur cree sa propre ligne et ne touche
     * plus les frais des reouvertures precedentes.
     */
    @Transactional
    public List<TicketFixedCost> recalculerTicket(Long ticketId) {
        // On reconstruit entierement le journal du ticket.
        repository.deleteByTicketId(ticketId);

        List<TicketCostEvent> events = eventRepository.findByTicketIdOrderByOrdreAscIdAsc(ticketId);

        // Plafond eventuel : total des frais <= plafond% du cumul supercost FINAL.
        Double plafond = lirePlafondReouverture();
        double cumulFinal = 0.0;
        for (TicketCostEvent e : events) {
            if (!Boolean.TRUE.equals(e.getAnnule()) && TicketCostEvent.TYPE_COST.equals(e.getType())) {
                cumulFinal += e.getMontant();
            }
        }
        double cap = plafond != null ? (plafond / 100.0) * cumulFinal : Double.MAX_VALUE;

        // Etat courant (en memoire) servant a calculer la base selon le mode.
        double cumul = 0.0;
        double premier = 0.0;
        double dernier = 0.0;
        double fraisRunning = 0.0;
        int nombre = 0;

        List<TicketFixedCost> lignes = new ArrayList<>();
        for (TicketCostEvent e : events) {
            if (Boolean.TRUE.equals(e.getAnnule())) {
                continue;
            }
            TicketFixedCost ligne = new TicketFixedCost();
            ligne.setTicketId(ticketId);
            ligne.setOrdre(e.getOrdre());

            if (TicketCostEvent.TYPE_COST.equals(e.getType())) {
                double montant = e.getMontant();
                if (nombre == 0) {
                    premier = montant;
                }
                cumul += montant;
                dernier = montant;
                nombre++;

                ligne.setType(TicketFixedCost.TYPE_COST);
                ligne.setMontant(montant);
                ligne.setCoutFixe(cumul);
            } else {
                double pct = e.getPourcentage();
                int mode = e.getModeCalcul();
                double base = calculerBase(mode, dernier, premier, cumul, nombre);
                double frais = base * (pct / 100.0);
                // Plafond : on n'ajoute pas au-dela du cap restant.
                double reste = Math.max(0.0, cap - fraisRunning);
                if (frais > reste) {
                    frais = reste;
                }
                fraisRunning += frais;

                ligne.setType(TicketFixedCost.TYPE_REOPEN);
                ligne.setCoutFixe(cumul);
                ligne.setBaseReouverture(base);
                ligne.setPourcentageReouverture(pct);
                ligne.setFraisReouverture(frais);
                ligne.setModeReouverture(mode);
            }
            lignes.add(ligne);
        }

        return repository.saveAll(lignes);
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
    private double calculerBase(int modeCalcul, double dernier, double premier, double somme, int nombre) {
        switch (modeCalcul) {
            case 2:
                return premier;
            case 3:
                return nombre > 0 ? somme / nombre : 0.0;
            case 4:
                return somme;
            case 1:
            default:
                return dernier;
        }
    }
}
