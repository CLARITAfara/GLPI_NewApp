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
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (3, 2, 2, 'Efa manao');
INSERT OR IGNORE INTO kanban_status_labels (id, status_id, language_id, label) VALUES (4, 3, 2, 'Vita');

-- Complète aussi une base existante dont les anciens IDs étaient associés au mauvais statut.
INSERT INTO kanban_status_labels (status_id, language_id, label)
SELECT 2, 2, 'Efa manao'
WHERE NOT EXISTS (
    SELECT 1 FROM kanban_status_labels WHERE status_id = 2 AND language_id = 2
);
INSERT INTO kanban_status_labels (status_id, language_id, label)
SELECT 3, 2, 'Vita'
WHERE NOT EXISTS (
    SELECT 1 FROM kanban_status_labels WHERE status_id = 3 AND language_id = 2
);

-- kanban_status_colors
INSERT OR IGNORE INTO kanban_status_colors (id, status_id, background_color) VALUES (1, 1, '#DBEAFE');
INSERT OR IGNORE INTO kanban_status_colors (id, status_id, background_color) VALUES (2, 2, '#FDE9CF');
INSERT OR IGNORE INTO kanban_status_colors (id, status_id, background_color) VALUES (3, 3, '#D6F0DD');

INSERT INTO kanban_status_colors (status_id, background_color)
SELECT 2, '#FDE9CF'
WHERE NOT EXISTS (
    SELECT 1 FROM kanban_status_colors WHERE status_id = 2
);
INSERT INTO kanban_status_colors (status_id, background_color)
SELECT 3, '#D6F0DD'
WHERE NOT EXISTS (
    SELECT 1 FROM kanban_status_colors WHERE status_id = 3
);
