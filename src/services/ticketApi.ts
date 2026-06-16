import { fetchLocale } from './apiClient'

export interface Ticket {
  id: number
  titre: string
  statut: string
  priorite: number
  cree_le: string
}

export async function getTickets(): Promise<Ticket[]> {
  const res = await fetchLocale('/tickets')
  return res.json() as Promise<Ticket[]>
}

export async function getTicket(id: number): Promise<Ticket> {
  const res = await fetchLocale(`/tickets/${id}`)
  return res.json() as Promise<Ticket>
}

export async function createTicket(data: {
  titre: string
  statut?: string
  priorite?: number
}): Promise<{ id: number }> {
  const res = await fetchLocale('/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<{ id: number }>
}

export async function deleteTicket(id: number): Promise<void> {
  await fetchLocale(`/tickets/${id}`, { method: 'DELETE' })
}
