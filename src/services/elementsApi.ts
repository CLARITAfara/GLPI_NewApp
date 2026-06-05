import { fetchList } from './glpiApi'
import type { GlpiRow } from './glpiApi'
import { refName } from './glpiApi'

export const ALL_ITEM_TYPES = [
  'Computer',
  'Monitor',
  'Printer',
  'Phone',
  'NetworkEquipment',
  'Peripheral',
  'Software',
  'Rack',
  'Appliance',
] as const

export type ItemType = (typeof ALL_ITEM_TYPES)[number]

const ITEM_ENDPOINTS: Record<ItemType, string> = {
  Computer: '/Assets/Computer',
  Monitor: '/Assets/Monitor',
  Printer: '/Assets/Printer',
  Phone: '/Assets/Phone',
  NetworkEquipment: '/Assets/NetworkEquipment',
  Peripheral: '/Assets/Peripheral',
  Software: '/Assets/Software',
  Rack: '/Assets/Rack',
  Appliance: '/Assets/Appliance',
}

export interface ElementFilters {
  name: string
  status: string
  location: string
  manufacturer: string
  itemType: string
  model: string
  inventoryNumber: string
  user: string
}

export const EMPTY_FILTERS: ElementFilters = {
  name: '',
  status: '',
  location: '',
  manufacturer: '',
  itemType: '',
  model: '',
  inventoryNumber: '',
  user: '',
}

export interface ElementRow {
  id: number
  itemType: string
  name: string
  status: string
  location: string
  manufacturer: string
  model: string
  inventoryNumber: string
  user: string
}

/** Nombre maximum d'items récupérés par endpoint. */
export const FETCH_LIMIT = 200

function normalizeRow(raw: GlpiRow, itemType: string): ElementRow {
  return {
    id: Number(raw.id ?? 0),
    itemType,
    name: refName(raw.name),
    status: refName(raw.status ?? raw.states_id),
    location: refName(raw.location ?? raw.locations_id),
    manufacturer: refName(raw.manufacturer ?? raw.manufacturers_id),
    model: refName(
      raw.model ??
        raw.computermodels_id ??
        raw.monitormodels_id ??
        raw.printermodels_id ??
        raw.phonemodels_id ??
        raw.networkequipmentmodels_id ??
        raw.peripheralmodels_id ??
        raw.softwareversions_id ??
        raw.rackmodels_id,
    ),
    inventoryNumber: String(raw.otherserial ?? raw.inventory_number ?? '—'),
    user: refName(raw.users_id_tech ?? raw.users_id ?? raw.user),
  }
}

async function fetchForType(type: ItemType): Promise<ElementRow[]> {
  try {
    const { items } = await fetchList(ITEM_ENDPOINTS[type], { limit: FETCH_LIMIT })
    return items.map((raw) => normalizeRow(raw, type))
  } catch {
    return []
  }
}

export interface FetchResult {
  rows: ElementRow[]
  truncated: boolean
}

/** Charge tous les éléments de tous les types depuis l'API (sans filtre côté client). */
export async function fetchAllElements(): Promise<FetchResult> {
  const results = await Promise.allSettled(ALL_ITEM_TYPES.map(fetchForType))

  let truncated = false
  const rows: ElementRow[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.length >= FETCH_LIMIT) truncated = true
      rows.push(...result.value)
    }
  }

  return { rows, truncated }
}

/** Filtre côté client — appliqué sur les données déjà chargées. */
export function applyFilters(rows: ElementRow[], filters: ElementFilters): ElementRow[] {
  const contains = (field: string, q: string) =>
    !q || field.toLowerCase().includes(q.toLowerCase())
  const exact = (field: string, q: string) => !q || field === q

  return rows.filter(
    (r) =>
      contains(r.name, filters.name) &&
      exact(r.status, filters.status) &&
      exact(r.location, filters.location) &&
      exact(r.manufacturer, filters.manufacturer) &&
      exact(r.itemType, filters.itemType) &&
      exact(r.model, filters.model) &&
      contains(r.inventoryNumber, filters.inventoryNumber) &&
      exact(r.user, filters.user),
  )
}

/** Extrait les valeurs uniques triées d'un champ, en excluant '—'. */
export function uniqueValues(rows: ElementRow[], field: keyof ElementRow): string[] {
  const seen = new Set<string>()
  for (const r of rows) {
    const v = String(r[field])
    if (v && v !== '—') seen.add(v)
  }
  return [...seen].sort()
}
