package com.glpi.newapp.controller;

import com.glpi.newapp.model.KanbanStatusLabel;
import com.glpi.newapp.service.KanbanStatusLabelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kanban-status-labels")
@RequiredArgsConstructor
public class KanbanStatusLabelController {

    private final KanbanStatusLabelService service;

    @GetMapping
    public List<KanbanStatusLabel> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<KanbanStatusLabel> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-status/{statusId}")
    public List<KanbanStatusLabel> getByStatus(@PathVariable Long statusId) {
        return service.findByStatusId(statusId);
    }

    @GetMapping("/by-language/{languageId}")
    public List<KanbanStatusLabel> getByLanguage(@PathVariable Long languageId) {
        return service.findByLanguageId(languageId);
    }

    @PostMapping
    public KanbanStatusLabel create(@Valid @RequestBody KanbanStatusLabel label) {
        return service.save(label);
    }

    @PutMapping("/{id}")
    public ResponseEntity<KanbanStatusLabel> update(@PathVariable Long id, @Valid @RequestBody KanbanStatusLabel label) {
        try {
            return ResponseEntity.ok(service.update(id, label));
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
