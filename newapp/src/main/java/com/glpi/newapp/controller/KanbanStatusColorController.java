package com.glpi.newapp.controller;

import com.glpi.newapp.model.KanbanStatusColor;
import com.glpi.newapp.service.KanbanStatusColorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kanban-status-colors")
@RequiredArgsConstructor
public class KanbanStatusColorController {

    private final KanbanStatusColorService service;

    @GetMapping
    public List<KanbanStatusColor> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<KanbanStatusColor> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-status/{statusId}")
    public List<KanbanStatusColor> getByStatus(@PathVariable Long statusId) {
        return service.findByStatusId(statusId);
    }

    @PostMapping
    public KanbanStatusColor create(@Valid @RequestBody KanbanStatusColor color) {
        return service.save(color);
    }

    @PutMapping("/{id}")
    public ResponseEntity<KanbanStatusColor> update(@PathVariable Long id, @Valid @RequestBody KanbanStatusColor color) {
        try {
            return ResponseEntity.ok(service.update(id, color));
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
