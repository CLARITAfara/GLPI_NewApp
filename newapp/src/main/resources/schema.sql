-- ============================================================
--  CONCEPTION BASE DE DONNÉES : GLPI Kanban
--  Moteur : SQLite  |  ORM : Hibernate (ddl-auto=none)
-- ============================================================

-- ------------------------------------------------------------
-- 1. languages
--    Référentiel des langues supportées (fr, mg, en)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS languages (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    code       TEXT     NOT NULL UNIQUE,
    name       TEXT     NOT NULL,
    is_active  INTEGER  NOT NULL DEFAULT 1,
    created_at DATETIME          DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. kanban_statuses
--    Statuts du tableau Kanban (NEW, IN_PROGRESS, DONE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanban_statuses (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    code       TEXT     NOT NULL UNIQUE,
    sort_order INTEGER  NOT NULL,
    is_active  INTEGER  NOT NULL DEFAULT 1,
    created_at DATETIME          DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. kanban_status_labels
--    Libellés localisés des statuts Kanban (i18n)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanban_status_labels (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    status_id   INTEGER  NOT NULL,
    language_id INTEGER  NOT NULL,
    label       TEXT     NOT NULL,
    created_at  DATETIME          DEFAULT CURRENT_TIMESTAMP,
    created_by  INTEGER,

    FOREIGN KEY (status_id)   REFERENCES kanban_statuses (id) ON DELETE CASCADE,
    FOREIGN KEY (language_id) REFERENCES languages        (id) ON DELETE CASCADE,
    UNIQUE (status_id, language_id)
);

-- ------------------------------------------------------------
-- 4. kanban_status_colors
--    Couleurs de fond associées aux statuts Kanban
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanban_status_colors (
    id               INTEGER  PRIMARY KEY AUTOINCREMENT,
    status_id        INTEGER  NOT NULL,
    background_color TEXT     NOT NULL,
    created_at       DATETIME          DEFAULT CURRENT_TIMESTAMP,
    created_by       INTEGER,

    FOREIGN KEY (status_id) REFERENCES kanban_statuses (id) ON DELETE CASCADE,
    UNIQUE (status_id)
);

CREATE TABLE IF NOT EXISTS ticket_fixed_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL UNIQUE,
    cout_fixe REAL NOT NULL DEFAULT 0,
    pourcentage_reouverture REAL NOT NULL DEFAULT 0,
    base_reouverture REAL NOT NULL DEFAULT 0,
    dernier_cout REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);