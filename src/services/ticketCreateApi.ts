import { apiFetch } from './apiClient'
import { ouvrirSession, associerElementTicket, uploadDisponible } from './legacyApi'

export type TicketType = 1 | 2
export type TicketLevel = 1 | 2 | 3 | 4 | 5

export interface TicketFormData {
  name: string
  content: string
  type: TicketType
  urgency: TicketLevel
  impact: TicketLevel
  priority: TicketLevel
}

export interface ItemToAssociate {
  id: number
  itemType: string
}

// Matrice GLPI : priority[urgency-1][impact-1]
const PRIORITY_MATRIX: TicketLevel[][] = [
  [1, 2, 2, 3, 3],
  [1, 2, 3, 3, 4],
  [2, 3, 3, 4, 4],
  [2, 3, 4, 4, 5],
  [3, 3, 4, 5, 5],
]

export function computePriority(urgency: TicketLevel, impact: TicketLevel): TicketLevel {
  return PRIORITY_MATRIX[urgency - 1][impact - 1]
}

async function parseError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (Array.isArray(body) && body.length > 0)
      return String((body[0] as Record<string, unknown>)?.message ?? '')
    if (body && typeof body === 'object' && 'message' in body)
      return String((body as Record<string, unknown>).message)
  } catch { /* corps non-JSON */ }
  return ''
}

export async function createTicket(data: TicketFormData): Promise<number> {
  const res = await apiFetch('/Assistance/Ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      content: data.content,
      type: data.type,
      urgency: data.urgency,
      impact: data.impact,
      priority: data.priority,
    }),
  })
  if (!res.ok) {
    const detail = await parseError(res)
    throw new Error(`Erreur ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
  const body = (await res.json()) as { id?: number } | number
  const id = typeof body === 'number' ? body : (body as { id?: number }).id
  if (!id) throw new Error('Identifiant du ticket non reçu.')
  return id
}

async function associateItem(ticketId: number, item: ItemToAssociate): Promise<void> {
  if (!uploadDisponible()) return
  await ouvrirSession()
  await associerElementTicket(ticketId, item.itemType, item.id)
}

export async function createTicketWithItems(
  data: TicketFormData,
  items: ItemToAssociate[],
): Promise<{ ticketId: number; itemErrors: number }> {
  const ticketId = await createTicket(data)

  let itemErrors = 0
  await Promise.allSettled(
    items.map(async (item) => {
      try {
        await associateItem(ticketId, item)
      } catch {
        itemErrors++
      }
    }),
  )

  return { ticketId, itemErrors }
}
