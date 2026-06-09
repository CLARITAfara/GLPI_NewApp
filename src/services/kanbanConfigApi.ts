// Service pour récupérer couleurs, langues et libellés des colonnes Kanban
// depuis l'API REST locale (http://localhost:8080).
// Le proxy Vite redirige /kanban-api/* → http://localhost:8080/api/*

import type { KanbanColumnId } from './ticketsFrontApi'

const BASE = '/kanban-api'

interface KanbanStatusApi {
  id: number
  code: string
  sortOrder: number
  isActive: number
}

interface KanbanStatusColor {
  id: number
  status: { id: number }
  backgroundColor: string
}

interface KanbanStatusLabel {
  id: number
  status: { id: number }
  language: { id: number }
  label: string
}

export interface Language {
  id: number
  code: string
  name: string
  isActive: number
}

export interface KanbanColumnConfig {
  backgroundColor: string | null
  label: string | null
}

function codeToColId(code: string): KanbanColumnId | null {
  const c = code.toUpperCase().replace(/-/g, '_')
  if (c === 'NEW') return 'new'
  if (c === 'IN_PROGRESS') return 'progress'
  if (c === 'DONE') return 'done'
  return null
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`Erreur ${res.status} — ${path}`)
  return res.json() as Promise<T>
}

/** Récupère la liste des langues actives disponibles. */
export async function chargerLangues(): Promise<Language[]> {
  try {
    const langs = await apiFetch<Language[]>('/languages')
    return langs.filter((l) => l.isActive !== 0)
  } catch {
    return []
  }
}

/**
 * Charge la configuration des colonnes (couleur de fond + libellé dans la langue choisie).
 * Si `langId` est null, `label` sera null pour toutes les colonnes (titre par défaut utilisé).
 */
export async function chargerConfigKanban(
  langId: number | null,
): Promise<Partial<Record<KanbanColumnId, KanbanColumnConfig>>> {
  try {
    const statuses = await apiFetch<KanbanStatusApi[]>('/kanban-statuses')
    const activeStatuses = statuses.filter((s) => s.isActive !== 0)

    const configs = await Promise.all(
      activeStatuses.map(async (s) => {
        const colId = codeToColId(s.code)
        if (!colId) return null

        const [colors, labels] = await Promise.all([
          apiFetch<KanbanStatusColor[]>(`/kanban-status-colors/by-status/${s.id}`).catch(() => [] as KanbanStatusColor[]),
          langId !== null
            ? apiFetch<KanbanStatusLabel[]>(`/kanban-status-labels/by-status/${s.id}`).catch(() => [] as KanbanStatusLabel[])
            : Promise.resolve([] as KanbanStatusLabel[]),
        ])

        const backgroundColor = colors[0]?.backgroundColor ?? null
        const label = langId !== null
          ? (labels.find((lb) => lb.language?.id === langId)?.label ?? null)
          : null

        return { colId, backgroundColor, label }
      }),
    )

    const result: Partial<Record<KanbanColumnId, KanbanColumnConfig>> = {}
    for (const c of configs) {
      if (c) result[c.colId] = { backgroundColor: c.backgroundColor, label: c.label }
    }
    return result
  } catch {
    return {}
  }
}
