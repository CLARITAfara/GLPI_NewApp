CREATE TABLE languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


| id | code | name     |
| -- | ---- | -------- |
| 1  | fr   | Français |
| 2  | mg   | Malagasy |
| 3  | en   | English  |



CREATE TABLE kanban_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);



| id | code        | sort_order |
| -- | ----------- | ---------- |
| 1  | NEW         | 1          |
| 2  | IN_PROGRESS | 2          |
| 3  | DONE        | 3          |


CREATE TABLE kanban_status_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_id INTEGER NOT NULL,
    language_id INTEGER NOT NULL,
    label TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,

    FOREIGN KEY(status_id) REFERENCES kanban_statuses(id),
    FOREIGN KEY(language_id) REFERENCES languages(id)
);


| id | status_id | language_id | label         |
| -- | --------- | ----------- | ------------- |
| 1  | 1         | 1           | Nouveau       |
| 2  | 1         | 2           | Vaovao        |
| 3  | 1         | 2           | Vaovao Ticket |


CREATE TABLE kanban_status_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_id INTEGER NOT NULL,

    background_color TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,

    FOREIGN KEY(status_id) REFERENCES kanban_statuses(id)
);

| id | status_id | background_color |
| -- | --------- | ---------------- |
| 1  | 1         | #3498DB          |
| 2  | 1         | #1ABC9C          |
| 3  | 1         | #9B59B6          |

