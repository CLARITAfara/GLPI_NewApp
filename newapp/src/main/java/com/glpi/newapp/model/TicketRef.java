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
@Table(name = "ticket_refs")
public class TicketRef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Ref_Ticket du CSV (1-based). */
    @Column(name = "ref", nullable = false, unique = true)
    private Long ref;

    /** Identifiant du ticket dans GLPI. */
    @Column(name = "glpi_ticket_id", nullable = false, unique = true)
    private Long glpiTicketId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
