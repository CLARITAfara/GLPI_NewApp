package com.glpi.newapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Journal des operations de cout d'un ticket : UNE LIGNE PAR OPERATION
 * (un supercost OU une reouverture). Reconstruit par rejeu des
 * ticket_cost_events a chaque modification.
 *
 * Chaque ligne REOPEN porte sa base, son pourcentage et son frais FIGES au
 * moment de la reouverture : un supercost ajoute PLUS TARD (ex. re-cloture du
 * ticket) ne modifie plus le frais d'une reouverture deja calculee. C'est ce
 * decoupage en lignes qui evite les incoherences de l'ancien agregat 1-ligne.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ticket_fixed_costs")
public class TicketFixedCost {

    public static final String TYPE_COST = "COST";
    public static final String TYPE_REOPEN = "REOPEN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    /** Ordre de l'operation dans le ticket (repris de l'event source). */
    @Column(name = "ordre", nullable = false)
    private Integer ordre = 0;

    /** 'COST' ou 'REOPEN'. */
    @Column(name = "type", nullable = false)
    private String type;

    /** Montant du supercost (type COST). */
    @Column(name = "montant", nullable = false)
    private Double montant = 0.0;

    /** Cumul des supercosts du ticket a l'instant de cette operation (informatif). */
    @Column(name = "cout_fixe", nullable = false)
    private Double coutFixe = 0.0;

    /** Base de calcul figee (type REOPEN). */
    @Column(name = "base_reouverture", nullable = false)
    private Double baseReouverture = 0.0;

    /** Pourcentage de CETTE reouverture (type REOPEN). */
    @Column(name = "pourcentage_reouverture", nullable = false)
    private Double pourcentageReouverture = 0.0;

    /** Frais figes de CETTE reouverture = base x pourcentage (type REOPEN). */
    @Column(name = "frais_reouverture", nullable = false)
    private Double fraisReouverture = 0.0;

    /** Mode de calcul utilise (1 a 4) (type REOPEN). */
    @Column(name = "mode_reouverture", nullable = false)
    private Integer modeReouverture = 1;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
