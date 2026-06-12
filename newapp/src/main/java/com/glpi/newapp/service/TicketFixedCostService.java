package com.glpi.newapp.service;

import com.glpi.newapp.model.TicketFixedCost;
import com.glpi.newapp.repository.TicketFixedCostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketFixedCostService {

    private final TicketFixedCostRepository repository;

    public List<TicketFixedCost> findAll() {
        return repository.findAll();
    }

    public TicketFixedCost enregistrer(TicketFixedCost entree) {
        TicketFixedCost cible = repository.findByTicketId(entree.getTicketId())
                .orElseGet(TicketFixedCost::new);
        cible.setTicketId(entree.getTicketId());
        cible.setCoutFixe(entree.getCoutFixe());
        return repository.save(cible);
    }
}
