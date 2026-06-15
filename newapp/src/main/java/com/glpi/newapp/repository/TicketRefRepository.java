package com.glpi.newapp.repository;

import com.glpi.newapp.model.TicketRef;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketRefRepository extends JpaRepository<TicketRef, Long> {
}
