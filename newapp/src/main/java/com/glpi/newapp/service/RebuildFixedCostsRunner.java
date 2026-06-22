package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketCostEvent;
import com.glpi.newapp.repository.TicketCostEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Au demarrage, reconstruit le journal ticket_fixed_costs (table derivee, videe
 * par schema.sql a chaque boot) en rejouant les ticket_cost_events de chaque
 * ticket. Rend la table auto-cicatrisante et gere la migration depuis l'ancien
 * schema sans intervention manuelle en base.
 */
@Component
@RequiredArgsConstructor
public class RebuildFixedCostsRunner implements ApplicationRunner {

    private final TicketCostEventRepository eventRepository;
    private final TicketFixedCostService service;

    @Override
    public void run(ApplicationArguments args) {
        Set<Long> ticketIds = new LinkedHashSet<>();
        for (TicketCostEvent e : eventRepository.findAll()) {
            ticketIds.add(e.getTicketId());
        }
        for (Long ticketId : ticketIds) {
            service.recalculerTicket(ticketId);
        }
    }
}
