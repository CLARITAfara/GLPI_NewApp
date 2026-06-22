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

-- Journal des operations de cout : UNE LIGNE PAR OPERATION (supercost OU
-- reouverture), reconstruit par rejeu de ticket_cost_events. Chaque ligne
-- REOPEN fige sa base / son pourcentage / son frais au moment de la reouverture,
-- ce qui evite qu'un cout ajoute plus tard ne fausse un frais deja calcule.
--
-- Table 100% DERIVEE de ticket_cost_events : on la recree a chaque demarrage
-- (le RebuildFixedCostsRunner la repeuple en rejouant les events). Le DROP
-- assure aussi la migration depuis l'ancien schema 1-ligne-par-ticket.
DROP TABLE IF EXISTS ticket_fixed_costs;
CREATE TABLE IF NOT EXISTS ticket_fixed_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    ordre INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,                              -- 'COST' | 'REOPEN'
    montant REAL NOT NULL DEFAULT 0,                 -- pour COST
    cout_fixe REAL NOT NULL DEFAULT 0,               -- cumul supercost a cet instant
    base_reouverture REAL NOT NULL DEFAULT 0,        -- pour REOPEN (figee)
    pourcentage_reouverture REAL NOT NULL DEFAULT 0, -- pour REOPEN (cette operation)
    frais_reouverture REAL NOT NULL DEFAULT 0,       -- pour REOPEN (figee = base x %)
    mode_reouverture INTEGER NOT NULL DEFAULT 1,     -- pour REOPEN
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 6. ticket_refs
--    Correspondance Ref_Ticket (CSV) → id de ticket GLPI.
--    Les Ref ne sont pas persistés côté GLPI : on les mémorise ici à l'import
--    pour résoudre un Ref vers le vrai id GLPI (coûts/mouvements).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_refs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    ref            INTEGER NOT NULL UNIQUE,
    glpi_ticket_id INTEGER NOT NULL UNIQUE,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 7. ticket_cost_events
--    Historique ordonne des operations de cout d'un ticket.
--    type = 'COST'   -> ajout d'un supercost (champ montant)
--    type = 'REOPEN' -> reouverture (champs pourcentage + mode_calcul)
--    La ligne agregee ticket_fixed_costs est reconstruite en rejouant
--    ces events dans l'ordre (colonne ordre).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_cost_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id   INTEGER NOT NULL,
    type        TEXT    NOT NULL,                 -- 'COST' | 'REOPEN'
    montant     REAL    NOT NULL DEFAULT 0,       -- pour COST
    pourcentage REAL    NOT NULL DEFAULT 0,       -- pour REOPEN
    mode_calcul INTEGER NOT NULL DEFAULT 1,       -- pour REOPEN (1..4)
    ordre       INTEGER NOT NULL,                 -- ordre d'application
    annule      INTEGER NOT NULL DEFAULT 0,        -- 0 = actif, 1 = annule (soft-delete)
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 8. app_settings
--    Parametres generaux de l'application (cle / valeur).
--    'plafond_reouverture' : plafond (en %) du cout de reouverture par rapport
--    au supercost. Pas d'interface : modifiable directement en base.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    cle    TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
);