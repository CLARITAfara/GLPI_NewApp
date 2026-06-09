package com.glpi.newapp.service;

import com.glpi.newapp.model.Language;
import com.glpi.newapp.repository.LanguageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LanguageService {

    private final LanguageRepository repository;

    public List<Language> findAll() {
        return repository.findAll();
    }

    public Optional<Language> findById(Long id) {
        return repository.findById(id);
    }

    public Language save(Language language) {
        return repository.save(language);
    }

    public Language update(Long id, Language updated) {
        return repository.findById(id).map(language -> {
            language.setCode(updated.getCode());
            language.setName(updated.getName());
            language.setIsActive(updated.getIsActive());
            return repository.save(language);
        }).orElseThrow(() -> new RuntimeException("Language not found: " + id));
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }
}
