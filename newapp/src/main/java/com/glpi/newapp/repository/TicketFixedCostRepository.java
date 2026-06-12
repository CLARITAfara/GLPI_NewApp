package com.glpi.newapp.repository;

import com.glpi.newapp.model.TicketFixedCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TicketFixedCostRepository extends JpaRepository<TicketFixedCost, Long> {
    Optional<TicketFixedCost> findByTicketId(Long ticketId);
}
