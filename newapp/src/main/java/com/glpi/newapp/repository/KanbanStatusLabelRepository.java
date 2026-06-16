package com.glpi.newapp.repository;

import com.glpi.newapp.model.KanbanStatusLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KanbanStatusLabelRepository extends JpaRepository<KanbanStatusLabel, Long> {
    List<KanbanStatusLabel> findByStatusId(Long statusId);
    List<KanbanStatusLabel> findByLanguageId(Long languageId);
}
