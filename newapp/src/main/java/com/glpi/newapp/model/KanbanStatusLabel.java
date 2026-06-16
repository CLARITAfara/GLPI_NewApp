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
@Table(name = "kanban_status_labels")
public class KanbanStatusLabel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "status_id", nullable = false)
    private KanbanStatus status;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "language_id", nullable = false)
    private Language language;

    @Column(nullable = false)
    private String label;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
