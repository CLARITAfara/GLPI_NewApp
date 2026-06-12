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

    @PostMapping
    public TicketFixedCost save(@RequestBody TicketFixedCost cout) {
        return service.enregistrer(cout);
    }
}
