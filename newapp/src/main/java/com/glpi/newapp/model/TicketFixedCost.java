package com.glpi.newapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ticket_fixed_costs")
public class TicketFixedCost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false, unique = true)
    private Long ticketId;

    @Column(name = "cout_fixe", nullable = false)
    private Double coutFixe = 0.0;

    @Column(name = "pourcentage_reouverture", nullable = false)
    private Double pourcentageReouverture = 0.0;

    @Column(name = "base_reouverture", nullable = false)
    private Double baseReouverture = 0.0;

    /**
     * Montant CUMULÉ des frais de réouverture, figé à chaque réouverture
     * (dernier coût × pourcentage). Ne diminue jamais : une annulation ne touche
     * que coutFixe/dernierCout, jamais ce champ.
     */
    @Column(name = "frais_reouverture", nullable = false)
    private Double fraisReouverture = 0.0;

    @Column(name = "dernier_cout", nullable = false)
    private Double dernierCout = 0.0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
