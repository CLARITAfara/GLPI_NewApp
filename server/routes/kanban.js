import { Router } from 'express'
import { db } from '../db.js'
import { requireBackofficeAuth } from '../middleware/auth.js'

export const kanbanRouter = Router()

// GET /api/backoffice/kanban-settings
kanbanRouter.get('/kanban-settings', requireBackofficeAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM kanban_settings ORDER BY id').all()
  res.json(rows)
})

// PUT /api/backoffice/kanban-settings
kanbanRouter.put('/kanban-settings', requireBackofficeAuth, (req, res) => {
  const settings = req.body
  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: 'Format invalide : tableau attendu.' })
  }

  const update = db.prepare(
    'UPDATE kanban_settings SET status_mg = ?, background_color = ? WHERE status_key = ?',
  )

  db.transaction(() => {
    for (const s of settings) {
      if (
        typeof s.status_key !== 'string' ||
        typeof s.status_mg !== 'string' ||
        typeof s.background_color !== 'string'
      ) continue
      update.run(s.status_mg.trim(), s.background_color, s.status_key)
    }
  })()

  const updated = db.prepare('SELECT * FROM kanban_settings ORDER BY id').all()
  res.json(updated)
})
