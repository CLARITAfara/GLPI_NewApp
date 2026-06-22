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
@Table(name = "ticket_cost_events")
public class TicketCostEvent {

    /** Type d'operation tracee dans l'historique. */
    public static final String TYPE_COST = "COST";
    public static final String TYPE_REOPEN = "REOPEN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    /** 'COST' ou 'REOPEN'. */
    @Column(name = "type", nullable = false)
    private String type;

    /** Montant du supercost (type COST). */
    @Column(name = "montant", nullable = false)
    private Double montant = 0.0;

    /** Pourcentage de reouverture (type REOPEN). */
    @Column(name = "pourcentage", nullable = false)
    private Double pourcentage = 0.0;

    /** Mode de calcul de la base de reouverture 1..4 (type REOPEN). */
    @Column(name = "mode_calcul", nullable = false)
    private Integer modeCalcul = 1;

    /** Ordre d'application des events du ticket (croissant). */
    @Column(name = "ordre", nullable = false)
    private Integer ordre = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
