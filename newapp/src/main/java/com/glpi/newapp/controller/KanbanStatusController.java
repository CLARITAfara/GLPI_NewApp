package com.glpi.newapp.controller;

import com.glpi.newapp.model.KanbanStatus;
import com.glpi.newapp.service.KanbanStatusService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kanban-statuses")
@RequiredArgsConstructor
public class KanbanStatusController {

    private final KanbanStatusService service;

    @GetMapping
    public List<KanbanStatus> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<KanbanStatus> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public KanbanStatus create(@Valid @RequestBody KanbanStatus status) {
        return service.save(status);
    }

    @PutMapping("/{id}")
    public ResponseEntity<KanbanStatus> update(@PathVariable Long id, @Valid @RequestBody KanbanStatus status) {
        try {
            return ResponseEntity.ok(service.update(id, status));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
