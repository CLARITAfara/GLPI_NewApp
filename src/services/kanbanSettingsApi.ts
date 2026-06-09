import { config } from '../config'
import { getTokens } from './tokenStore'

export interface KanbanSetting {
  id: number
  status_key: string
  status_fr: string
  status_mg: string
  background_color: string
}

function authHeaders(): HeadersInit {
  const tokens = getTokens()
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
  }
}

export async function fetchKanbanSettings(): Promise<KanbanSetting[]> {
  const res = await fetch(`${config.localApiUrl}/backoffice/kanban-settings`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Erreur serveur ${res.status}`)
  return res.json() as Promise<KanbanSetting[]>
}

export async function saveKanbanSettings(settings: KanbanSetting[]): Promise<KanbanSetting[]> {
  const res = await fetch(`${config.localApiUrl}/backoffice/kanban-settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error(`Erreur serveur ${res.status}`)
  return res.json() as Promise<KanbanSetting[]>
}
