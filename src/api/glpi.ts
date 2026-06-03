import { apiFetch } from './auth'

/** Une ligne générique renvoyée par l'API GLPI */
export type GlpiRow = Record<string, unknown>

export interface ListResult {
  items: GlpiRow[]
  total: number
}

/**
 * Récupère une liste paginée depuis l'API GLPI.
 * Le total est lu dans l'en-tête Content-Range ("0-5/6" -> 6).
 */
export async function fetchList(
  path: string,
  params: { start?: number; limit?: number } = {},
): Promise<ListResult> {
  const start = params.start ?? 0
  const limit = params.limit ?? 20
  const qs = new URLSearchParams({ start: String(start), limit: String(limit) })

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
