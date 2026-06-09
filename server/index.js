// Désactive la vérification SSL pour les certificats auto-signés en dev
// (identique à secure:false dans vite.config.ts).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import express from 'express'
import cors from 'cors'
import { kanbanRouter } from './routes/kanban.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/backoffice', kanbanRouter)

app.listen(PORT, () => {
  console.log(`Serveur local démarré → http://localhost:${PORT}`)
})
