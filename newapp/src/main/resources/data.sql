-- ============================================================
--  DONNÉES INITIALES
--  INSERT OR IGNORE : idempotent (pas de doublon au redémarrage)
-- ============================================================

-- languages
INSERT OR IGNORE INTO languages (id, code, name, is_active) VALUES (1, 'fr', 'Français', 1);
INSERT OR IGNORE INTO languages (id, code, name, is_active) VALUES (2, 'mg', 'Malagasy', 1);
INSERT OR IGNORE INTO languages (id, code, name, is_active) VALUES (3, 'en', 'English',  1);

-- kanban_statuses
INSERT OR IGNORE INTO kanban_statuses (id, code, sort_order, is_active) VALUES (1, 'NEW',         1, 1);
INSERT OR IGNORE INTO kanban_statuses (id, code, sort_order, is_active) VALUES (2, 'IN_PROGRESS', 2, 1);
INSERT OR IGNORE INTO kanban_statuses (id, code, sort_order, is_active) VALUES (3, 'DONE',        3, 1);

-- kanban_status_labels
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (1, 1, 1, 'Nouveau');
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (2, 1, 2, 'Vaovao');
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (3, 1, 2, 'Vaovao Ticket');

-- kanban_status_colors
INSERT OR IGNORE INTO kanban_status_colors (id, status_id, background_color) VALUES (1, 1, '#3498DB');
INSERT OR IGNORE INTO kanban_status_colors (id, status_id, background_color) VALUES (2, 1, '#1ABC9C');
INSERT OR IGNORE INTO kanban_status_colors (id, status_id, background_color) VALUES (3, 1, '#9B59B6');
