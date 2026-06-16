package com.glpi.newapp.service;

import com.glpi.newapp.model.KanbanStatus;
import com.glpi.newapp.repository.KanbanStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class KanbanStatusService {

    private final KanbanStatusRepository repository;

    public List<KanbanStatus> findAll() {
        return repository.findAll();
    }

    public Optional<KanbanStatus> findById(Long id) {
        return repository.findById(id);
    }

    public KanbanStatus save(KanbanStatus status) {
        return repository.save(status);
    }

    public KanbanStatus update(Long id, KanbanStatus updated) {
        return repository.findById(id).map(status -> {
            status.setCode(updated.getCode());
            status.setSortOrder(updated.getSortOrder());
            status.setIsActive(updated.getIsActive());
            return repository.save(status);
        }).orElseThrow(() -> new RuntimeException("KanbanStatus not found: " + id));
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }
}
