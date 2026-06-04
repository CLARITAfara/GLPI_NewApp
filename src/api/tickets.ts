const BASE = 'http://localhost:3001/api'

export interface Ticket {
  id: number
  titre: string
  statut: string
  priorite: number
  cree_le: string
}

export async function getTickets(): Promise<Ticket[]> {
  const res = await fetch(`${BASE}/tickets`)
  return res.json()
}

export async function getTicket(id: number): Promise<Ticket> {
  const res = await fetch(`${BASE}/tickets/${id}`)
  return res.json()
}

export async function createTicket(data: {
  titre: string
  statut?: string
  priorite?: number
}): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteTicket(id: number): Promise<void> {
  await fetch(`${BASE}/tickets/${id}`, { method: 'DELETE' })
}
