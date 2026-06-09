package com.glpi.newapp.controller;

import com.glpi.newapp.model.Language;
import com.glpi.newapp.service.LanguageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/languages")
@RequiredArgsConstructor
public class LanguageController {

    private final LanguageService service;

    @GetMapping
    public List<Language> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Language> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Language create(@Valid @RequestBody Language language) {
        return service.save(language);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Language> update(@PathVariable Long id, @Valid @RequestBody Language language) {
        try {
            return ResponseEntity.ok(service.update(id, language));
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
