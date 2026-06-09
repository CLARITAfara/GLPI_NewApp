package com.glpi.newapp.repository;

import com.glpi.newapp.model.KanbanStatusColor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KanbanStatusColorRepository extends JpaRepository<KanbanStatusColor, Long> {
    List<KanbanStatusColor> findByStatusId(Long statusId);
}
