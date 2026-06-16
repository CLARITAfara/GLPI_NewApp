package com.glpi.newapp.controller;

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

    @PostMapping("/by-ticket/{ticketId}/add")
    public TicketFixedCost addCout(@PathVariable Long ticketId, @RequestParam double montant) {
        return service.ajouterCout(ticketId, montant);
    }

    @PostMapping("/by-ticket/{ticketId}/cancel-last")
    public TicketFixedCost cancelLast(@PathVariable Long ticketId) {
        return service.annulerDernierCout(ticketId);
    }

    @PostMapping("/by-ticket/{ticketId}/reopen")
    public TicketFixedCost reopen(@PathVariable Long ticketId, @RequestParam double pourcentage) {
        return service.appliquerReouverture(ticketId, pourcentage);
    }
}
