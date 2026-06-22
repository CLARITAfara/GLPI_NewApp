package com.glpi.newapp.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Au demarrage, reconstruit le journal ticket_fixed_costs (table derivee, videe
 * par schema.sql a chaque boot) en rejouant les ticket_cost_events de chaque
 * ticket. Rend la table auto-cicatrisante et gere la migration depuis l'ancien
 * schema sans intervention manuelle en base.
 *
 * S'execute APRES le SchemaMigrationRunner (@Order), qui garantit la presence
 * des colonnes attendues sur ticket_cost_events.
 */
@Component
@Order(2)
@RequiredArgsConstructor
public class RebuildFixedCostsRunner implements ApplicationRunner {

    private final TicketFixedCostService service;

    @Override
    public void run(ApplicationArguments args) {
        service.recalculerTous();
    }
}
