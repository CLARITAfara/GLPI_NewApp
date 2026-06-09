package com.glpi.newapp.service;

import com.glpi.newapp.model.KanbanStatusLabel;
import com.glpi.newapp.repository.KanbanStatusLabelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class KanbanStatusLabelService {

    private final KanbanStatusLabelRepository repository;

    public List<KanbanStatusLabel> findAll() {
        return repository.findAll();
    }

    public Optional<KanbanStatusLabel> findById(Long id) {
        return repository.findById(id);
    }

    public List<KanbanStatusLabel> findByStatusId(Long statusId) {
        return repository.findByStatusId(statusId);
    }

    public List<KanbanStatusLabel> findByLanguageId(Long languageId) {
        return repository.findByLanguageId(languageId);
    }

    public KanbanStatusLabel save(KanbanStatusLabel label) {
        return repository.save(label);
    }

    public KanbanStatusLabel update(Long id, KanbanStatusLabel updated) {
        return repository.findById(id).map(label -> {
            label.setStatus(updated.getStatus());
            label.setLanguage(updated.getLanguage());
            label.setLabel(updated.getLabel());
            label.setCreatedBy(updated.getCreatedBy());
            return repository.save(label);
        }).orElseThrow(() -> new RuntimeException("KanbanStatusLabel not found: " + id));
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }
}
