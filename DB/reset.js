// =====================================================================
//  reset.js — Réinitialise la base SQLite
//  - Sauvegarde la base avant de modifier quoi que ce soit
//  - Vide toutes les tables (données transactionnelles)
//  - Réinsère les données essentielles depuis seed.sql
//
//  Usage : node DB/reset.js
// =====================================================================

import Database from 'better-sqlite3'
import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath    = join(__dirname, 'glpi.sqlite')
const seedPath  = join(__dirname, 'seed.sql')
const backupDir = join(__dirname, 'backups')

// -- 1. Sauvegarde automatique avant reset --------------------------------
if (!existsSync(backupDir)) mkdirSync(backupDir)

const stamp      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupPath = join(backupDir, `glpi_pre-reset_${stamp}.sqlite`)
copyFileSync(dbPath, backupPath)
console.log(`Sauvegarde : ${backupPath}`)

// -- 2. Connexion à la base -----------------------------------------------
const db = new Database(dbPath)

// -- 3. Récupérer toutes les tables utilisateur ---------------------------
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map(r => r.name)

console.log(`Tables détectées : ${tables.join(', ')}`)

// -- 4. Vider toutes les tables + remettre les compteurs à zéro -----------
db.transaction(() => {
  for (const table of tables) {
    db.prepare(`DELETE FROM "${table}"`).run()
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table)
    console.log(`  Vidé : ${table}`)
  }
})()

// -- 5. Réinsérer les données essentielles depuis seed.sql ----------------
if (existsSync(seedPath)) {
  const sql = readFileSync(seedPath, 'utf8')
  db.exec(sql)
  console.log('Données essentielles insérées (seed.sql)')
} else {
  console.log('Aucun seed.sql trouvé — base vide.')
}

db.close()
console.log('Reset terminé.')
