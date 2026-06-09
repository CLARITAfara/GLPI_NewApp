package com.glpi.newapp.repository;

import com.glpi.newapp.model.KanbanStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KanbanStatusRepository extends JpaRepository<KanbanStatus, Long> {
    boolean existsByCode(String code);
}
