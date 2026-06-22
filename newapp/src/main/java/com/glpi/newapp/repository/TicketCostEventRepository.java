package com.glpi.newapp.repository;

import com.glpi.newapp.model.TicketCostEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketCostEventRepository extends JpaRepository<TicketCostEvent, Long> {

    /** Events d'un ticket dans l'ordre d'application. */
    List<TicketCostEvent> findByTicketIdOrderByOrdreAscIdAsc(Long ticketId);

    /** Tout l'historique, regroupe par ticket puis ordonne. */
    List<TicketCostEvent> findAllByOrderByTicketIdAscOrdreAscIdAsc();

    /** Nombre d'events deja enregistres pour un ticket (pour appendre). */
    int countByTicketId(Long ticketId);
}
