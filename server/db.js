import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '..', 'DB', 'glpi.sqlite')

export const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS kanban_settings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    status_key       TEXT    NOT NULL UNIQUE,
    status_fr        TEXT    NOT NULL,
    status_mg        TEXT    NOT NULL,
    background_color TEXT    NOT NULL DEFAULT '#f0f0f0'
  );

  INSERT OR IGNORE INTO kanban_settings (status_key, status_fr, status_mg, background_color) VALUES
    ('new',         'Nouveau',     'Vaovao',    '#e3f2fd'),
    ('in_progress', 'In progress', 'Efa manao', '#fff9c4'),
    ('done',        'Terminé',     'Vita',      '#e8f5e9');
`)
