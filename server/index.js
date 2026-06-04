import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, '../DB/glpi.sqlite'))

const app = express()
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

function registerTableRoutes(tableName) {
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all()
  const pk = columns.find(c => c.pk === 1)?.name ?? 'id'
  const writableCols = columns.filter(c => c.pk === 0).map(c => c.name)

  // GET all
  app.get(`/api/${tableName}`, (req, res) => {
    const rows = db.prepare(`SELECT * FROM "${tableName}"`).all()
    res.json(rows)
  })

  // GET by id
  app.get(`/api/${tableName}/:id`, (req, res) => {
    const row = db.prepare(`SELECT * FROM "${tableName}" WHERE "${pk}" = ?`).get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Non trouvé' })
    res.json(row)
  })

  // POST create
  app.post(`/api/${tableName}`, (req, res) => {
    const fields = writableCols.filter(n => req.body[n] !== undefined)
    if (fields.length === 0) return res.status(400).json({ error: 'Aucune donnée fournie' })
    const result = db.prepare(
      `INSERT INTO "${tableName}" (${fields.map(f => `"${f}"`).join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`
    ).run(...fields.map(f => req.body[f]))
    res.status(201).json({ [pk]: result.lastInsertRowid })
  })

  // PUT update
  app.put(`/api/${tableName}/:id`, (req, res) => {
    const fields = writableCols.filter(n => req.body[n] !== undefined)
    if (fields.length === 0) return res.status(400).json({ error: 'Aucune donnée fournie' })
    db.prepare(
      `UPDATE "${tableName}" SET ${fields.map(f => `"${f}" = ?`).join(', ')} WHERE "${pk}" = ?`
    ).run(...fields.map(f => req.body[f]), req.params.id)
    res.json({ updated: true })
  })

  // DELETE
  app.delete(`/api/${tableName}/:id`, (req, res) => {
    db.prepare(`DELETE FROM "${tableName}" WHERE "${pk}" = ?`).run(req.params.id)
    res.status(204).send()
  })

  return { table: tableName, pk, columns: columns.map(c => c.name) }
}

// Découverte automatique de toutes les tables au démarrage
const tables = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
).all()

const registered = tables.map(({ name }) => registerTableRoutes(name))

// GET /api — liste toutes les routes disponibles
app.get('/api', (req, res) => {
  res.json(registered.map(({ table, pk, columns }) => ({
    table,
    pk,
    columns,
    endpoints: [
      `GET    /api/${table}`,
      `GET    /api/${table}/:${pk}`,
      `POST   /api/${table}`,
      `PUT    /api/${table}/:${pk}`,
      `DELETE /api/${table}/:${pk}`,
    ],
  })))
})

app.listen(3001, () => {
  console.log('API sur http://localhost:3001')
  console.log(`Tables détectées : ${registered.map(r => r.table).join(', ') || 'aucune'}`)
})
