package com.glpi.newapp.repository;

import com.glpi.newapp.model.TicketFixedCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketFixedCostRepository extends JpaRepository<TicketFixedCost, Long> {

    /** Toutes les lignes (operations) d'un ticket, dans l'ordre d'application. */
    List<TicketFixedCost> findByTicketIdOrderByOrdreAscIdAsc(Long ticketId);

    void deleteByTicketId(Long ticketId);
}
