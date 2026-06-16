import { useEffect, useState } from 'react'
import { getTickets, type Ticket } from '../services/ticketApi'

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTickets()
      .then(setTickets)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Chargement…</p>
  if (tickets.length === 0) return <p>Aucun ticket.</p>

  return (
    <ul>
      {tickets.map((t) => (
        <li key={t.id}>
          <strong>{t.titre}</strong> — {t.statut} (priorité {t.priorite})
        </li>
      ))}
    </ul>
  )
}
