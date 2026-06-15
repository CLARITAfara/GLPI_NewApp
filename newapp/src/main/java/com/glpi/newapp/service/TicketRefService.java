package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketRef;
import com.glpi.newapp.repository.TicketRefRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketRefService {

    private final TicketRefRepository repository;

    public List<TicketRef> findAll() {
        return repository.findAll();
    }

    /**
     * Remplace toute la table par le lot fourni : un import recrée les tickets
     * dans GLPI (nouveaux ids), l'ancienne correspondance devient caduque. On
     * repart d'une table propre pour éviter les conflits d'unicité (ref / id).
     */
    @Transactional
    public List<TicketRef> remplacerTout(List<TicketRef> refs) {
        repository.deleteAllInBatch();
        return repository.saveAll(refs);
    }

    @Transactional
    public void supprimerTout() {
        repository.deleteAllInBatch();
    }
}
