package com.glpi.newapp.controller;

import com.glpi.newapp.model.TicketRef;
import com.glpi.newapp.service.TicketRefService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ticket-refs")
@RequiredArgsConstructor
public class TicketRefController {

    private final TicketRefService service;

    @GetMapping
    public List<TicketRef> getAll() {
        return service.findAll();
    }

    @PostMapping
    public List<TicketRef> replaceAll(@RequestBody List<TicketRef> refs) {
        return service.remplacerTout(refs);
    }

    @DeleteMapping
    public void deleteAll() {
        service.supprimerTout();
    }
}
