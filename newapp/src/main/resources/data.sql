-- ============================================================
--  DONNÉES INITIALES
--  INSERT OR IGNORE : idempotent (pas de doublon au redémarrage)
-- ============================================================

-- languages
INSERT OR IGNORE INTO languages (id, code, name, is_active) VALUES (1, 'mg', 'Malagasy', 1);

-- kanban_statuses
INSERT OR IGNORE INTO kanban_statuses (id, code, sort_order, is_active) VALUES (1, 'NEW',         1, 1);
INSERT OR IGNORE INTO kanban_statuses (id, code, sort_order, is_active) VALUES (2, 'IN_PROGRESS', 2, 1);
INSERT OR IGNORE INTO kanban_statuses (id, code, sort_order, is_active) VALUES (3, 'DONE',        3, 1);

-- kanban_status_labels
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (1, 1, 1, 'Vaovao');
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (2, 2, 1, 'Efa manao');
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (3, 3, 1, 'Vita');

-- Complète aussi une base existante dont les anciens IDs étaient associés au mauvais statut.
-- kanban_status_colors

