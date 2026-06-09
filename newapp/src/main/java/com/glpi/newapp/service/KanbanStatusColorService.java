package com.glpi.newapp.service;

import com.glpi.newapp.model.KanbanStatusColor;
import com.glpi.newapp.repository.KanbanStatusColorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class KanbanStatusColorService {

    private final KanbanStatusColorRepository repository;

    public List<KanbanStatusColor> findAll() {
        return repository.findAll();
    }

    public Optional<KanbanStatusColor> findById(Long id) {
        return repository.findById(id);
    }

    public List<KanbanStatusColor> findByStatusId(Long statusId) {
        return repository.findByStatusId(statusId);
    }

    public KanbanStatusColor save(KanbanStatusColor color) {
        return repository.save(color);
    }

    public KanbanStatusColor update(Long id, KanbanStatusColor updated) {
        return repository.findById(id).map(color -> {
            color.setStatus(updated.getStatus());
            color.setBackgroundColor(updated.getBackgroundColor());
            color.setCreatedBy(updated.getCreatedBy());
            return repository.save(color);
        }).orElseThrow(() -> new RuntimeException("KanbanStatusColor not found: " + id));
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }
}
