import { apiFetch } from './apiClient'

/** Une ligne générique renvoyée par l'API GLPI */
export type GlpiRow = Record<string, unknown>

export interface ListResult {
  items: GlpiRow[]
  total: number
}

/**
 * Récupère une liste paginée depuis l'API GLPI.
 * Le total est lu dans l'en-tête Content-Range ("0-5/6" -> 6).
 *
 * Par défaut, les éléments à la corbeille (is_deleted==true) sont exclus
 * sur toute l'application. Passer `includeDeleted: true` pour les inclure.
 */
export async function fetchList(
  path: string,
  params: { start?: number; limit?: number; filter?: string; includeDeleted?: boolean } = {},
): Promise<ListResult> {
  const start = params.start ?? 0
  const limit = params.limit ?? 20
  const qs = new URLSearchParams({ start: String(start), limit: String(limit) })

  const filtres: string[] = []
  if (!params.includeDeleted) filtres.push('is_deleted==false')
  if (params.filter) filtres.push(params.filter)
  if (filtres.length > 0) qs.set('filter', filtres.join(';')) // ; = AND en RSQL

  const res = await apiFetch(`${path}?${qs.toString()}`)
  if (!res.ok) {
    throw new Error(`Erreur ${res.status} lors du chargement.`)
  }

  const items = (await res.json()) as GlpiRow[]
  const total = parseTotal(res.headers.get('Content-Range'), items.length)
  return { items, total }
}

function parseTotal(contentRange: string | null, fallback: number): number {
  if (!contentRange) return fallback
  const slash = contentRange.lastIndexOf('/')
  if (slash === -1) return fallback
  const total = Number(contentRange.slice(slash + 1))
  return Number.isFinite(total) ? total : fallback
}

/** Affiche le nom d'un objet lié ({id,name}) ou une valeur simple */
export function refName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { name: unknown }).name ?? '—')
  }
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

/**
 * Récupère le nombre total d'enregistrements d'une ressource GLPI,
 * sans rapatrier les données (lit l'en-tête Content-Range).
 *
 * @param filter  Filtre RSQL optionnel (ex. "is_deleted==false" pour
 *                exclure les éléments à la corbeille).
 */
export async function fetchCount(
  path: string,
  opts: { filter?: string; includeDeleted?: boolean } = {},
): Promise<number> {
  const { total } = await fetchList(path, { start: 0, limit: 1, ...opts })
  return total
}

/** Récupère tous les IDs d'une ressource GLPI (pagine automatiquement). */
export async function fetchAllIds(
  path: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<number[]> {
  const ids: number[] = []
  const pageSize = 500
  let start = 0

  while (true) {
    const result = await fetchList(path, { start, limit: pageSize, ...opts })
    for (const item of result.items) {
      if (typeof item.id === 'number') ids.push(item.id)
    }
    start += result.items.length
    if (start >= result.total || result.items.length === 0) break
  }

  return ids
}

/**
 * Supprime un élément par son endpoint et son ID (soft delete — corbeille GLPI).
 * Un 404 est traité comme succès (déjà supprimé).
 */
export async function supprimerItem(path: string, id: number): Promise<void> {
  const res = await apiFetch(`${path}/${id}`, { method: 'DELETE' })
  if (res.ok || res.status === 404) return

  let detail = ''
  try {
    const body: unknown = await res.json()
    if (Array.isArray(body) && body.length > 0) {
      const first = body[0] as Record<string, unknown>
      detail = String(first?.message ?? '')
    } else if (body !== null && typeof body === 'object' && 'message' in body) {
      detail = String((body as Record<string, unknown>).message)
    }
  } catch {
    // corps non-JSON, on ignore
  }

  throw new Error(`Erreur ${res.status}${detail ? ` — ${detail}` : ''}`)
}
