import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import mysql from 'mysql2/promise'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

// -- SQLite (tables custom) ------------------------------------------------
const sqlite = new Database(join(__dirname, '../DB/glpi.sqlite'))

// -- MySQL (base GLPI) -----------------------------------------------------
const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     ?? 'localhost',
  user:     process.env.MYSQL_USER     ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? 'root',
  database: process.env.MYSQL_DB       ?? 'glpi',
})

const MYSQLDUMP = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe'
const MYSQL_DB  = process.env.MYSQL_DB ?? 'glpi'
const MYSQL_USER = process.env.MYSQL_USER ?? 'root'
const MYSQL_PASS = process.env.MYSQL_PASSWORD ?? 'root'

const app = express()
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// ── CRUD SQLite auto-généré ──────────────────────────────────────────────

function registerTableRoutes(tableName) {
  const columns = sqlite.prepare(`PRAGMA table_info("${tableName}")`).all()
  const pk = columns.find(c => c.pk === 1)?.name ?? 'id'
  const writableCols = columns.filter(c => c.pk === 0).map(c => c.name)

  app.get(`/api/${tableName}`, (req, res) => {
    res.json(sqlite.prepare(`SELECT * FROM "${tableName}"`).all())
  })

  app.get(`/api/${tableName}/:id`, (req, res) => {
    const row = sqlite.prepare(`SELECT * FROM "${tableName}" WHERE "${pk}" = ?`).get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Non trouvé' })
    res.json(row)
  })

  app.post(`/api/${tableName}`, (req, res) => {
    const fields = writableCols.filter(n => req.body[n] !== undefined)
    if (fields.length === 0) return res.status(400).json({ error: 'Aucune donnée fournie' })
    const result = sqlite.prepare(
      `INSERT INTO "${tableName}" (${fields.map(f => `"${f}"`).join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`
    ).run(...fields.map(f => req.body[f]))
    res.status(201).json({ [pk]: result.lastInsertRowid })
  })

  app.put(`/api/${tableName}/:id`, (req, res) => {
    const fields = writableCols.filter(n => req.body[n] !== undefined)
    if (fields.length === 0) return res.status(400).json({ error: 'Aucune donnée fournie' })
    sqlite.prepare(
      `UPDATE "${tableName}" SET ${fields.map(f => `"${f}" = ?`).join(', ')} WHERE "${pk}" = ?`
    ).run(...fields.map(f => req.body[f]), req.params.id)
    res.json({ updated: true })
  })

  app.delete(`/api/${tableName}/:id`, (req, res) => {
    sqlite.prepare(`DELETE FROM "${tableName}" WHERE "${pk}" = ?`).run(req.params.id)
    res.status(204).send()
  })

  return { table: tableName, pk, columns: columns.map(c => c.name) }
}

const sqliteTables = sqlite.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
).all()
const registered = sqliteTables.map(({ name }) => registerTableRoutes(name))

app.get('/api', (req, res) => {
  res.json(registered.map(({ table, pk, columns }) => ({
    table, pk, columns,
    endpoints: [
      `GET    /api/${table}`,
      `GET    /api/${table}/:${pk}`,
      `POST   /api/${table}`,
      `PUT    /api/${table}/:${pk}`,
      `DELETE /api/${table}/:${pk}`,
    ],
  })))
})

// ── Modules GLPI (MySQL) ─────────────────────────────────────────────────

app.get('/api/_modules', async (req, res) => {
  const modules = JSON.parse(readFileSync(join(__dirname, '../DB/modules.json'), 'utf8'))
  const conn = await pool.getConnection()
  try {
    const result = await Promise.all(
      Object.entries(modules).map(async ([name, mod]) => ({
        name,
        description: mod.description,
        tables: await Promise.all(
          mod.tables.map(async table => {
            try {
              const [[row]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``)
              return { table, rows: row.n }
            } catch {
              return { table, rows: null, error: 'Table introuvable' }
            }
          })
        ),
      }))
    )
    res.json(result)
  } finally {
    conn.release()
  }
})

app.post('/api/_reset', async (req, res) => {
  const { module: moduleName } = req.body
  if (!moduleName) return res.status(400).json({ error: 'Champ "module" requis' })

  const modules = JSON.parse(readFileSync(join(__dirname, '../DB/modules.json'), 'utf8'))
  const mod = modules[moduleName]
  if (!mod) return res.status(404).json({ error: `Module "${moduleName}" introuvable` })

  // Sauvegarde mysqldump des tables concernées avant reset
  const backupDir = join(__dirname, '../DB/backups')
  if (!existsSync(backupDir)) mkdirSync(backupDir)
  const stamp      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupFile = join(backupDir, `glpi_pre-reset_${moduleName}_${stamp}.sql`)
  const tableList  = mod.tables.join(' ')

  try {
    await execAsync(
      `"${MYSQLDUMP}" -u${MYSQL_USER} -p${MYSQL_PASS} --single-transaction --result-file="${backupFile}" ${MYSQL_DB} ${tableList}`
    )
  } catch {
    // Backup échoué (mysqldump absent) — on continue quand même
  }

  // Vider les tables via TRUNCATE (désactive FK temporairement)
  const conn = await pool.getConnection()
  const cleared = []
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of mod.tables) {
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``)
        cleared.push(table)
      } catch (e) {
        cleared.push(`${table} (erreur: ${e.message})`)
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
    res.json({ module: moduleName, cleared, backup: backupFile })
  } finally {
    conn.release()
  }
})

app.listen(3001, () => {
  console.log('API sur http://localhost:3001')
  console.log(`SQLite tables : ${registered.map(r => r.table).join(', ') || 'aucune'}`)
  console.log(`MySQL GLPI    : ${MYSQL_DB}@${process.env.MYSQL_HOST ?? 'localhost'}`)
})
