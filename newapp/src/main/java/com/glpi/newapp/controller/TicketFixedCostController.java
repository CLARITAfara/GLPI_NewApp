package com.glpi.newapp.controller;

import com.glpi.newapp.model.TicketCostEvent;
import com.glpi.newapp.model.TicketFixedCost;
import com.glpi.newapp.service.TicketFixedCostService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ticket-fixed-costs")
@RequiredArgsConstructor
public class TicketFixedCostController {

    private final TicketFixedCostService service;

    @GetMapping
    public List<TicketFixedCost> getAll() {
        return service.findAll();
    }

    @DeleteMapping
    public void deleteAll() {
        service.supprimerTout();
    }

    /** Historique complet des events (reouvertures + supercosts). */
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
    public List<TicketFixedCost> modifierEvent(@PathVariable Long eventId,
                                               @RequestBody ModifierEventRequest corps) {
        return service.modifierEvent(eventId, corps.montant(), corps.pourcentage(), corps.modeCalcul());
    }

    /** Payload d'edition d'un event. Champs null = inchanges. */
    public record ModifierEventRequest(Double montant, Double pourcentage, Integer modeCalcul) {}

    /** Retablit un mouvement annule puis recalcule le ticket. */
    @PostMapping("/events/{eventId}/restore")
    public List<TicketFixedCost> restaurerEvent(@PathVariable Long eventId) {
        return service.restaurerEvent(eventId);
    }

    @PostMapping("/by-ticket/{ticketId}/add")
    public List<TicketFixedCost> addCout(@PathVariable Long ticketId, @RequestParam double montant) {
        return service.ajouterCout(ticketId, montant);
    }

    @PostMapping("/by-ticket/{ticketId}/cancel-last")
    public List<TicketFixedCost> cancelLast(@PathVariable Long ticketId) {
        return service.annulerDernierCout(ticketId);
    }

    @PostMapping("/by-ticket/{ticketId}/reopen")
    public List<TicketFixedCost> reopen(@PathVariable Long ticketId,
                                        @RequestParam double pourcentage,
                                        @RequestParam(defaultValue = "1") int modeCalcul) {
        return service.appliquerReouverture(ticketId, pourcentage, modeCalcul);
    }
}
