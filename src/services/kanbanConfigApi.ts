import type { KanbanColumnId } from './ticketsFrontApi'

const BASE = '/kanban-api'

export interface KanbanStatusApi {
  id: number
  code: string
  sortOrder: number
  isActive: number
}

export interface KanbanStatusColor {
  id: number
  status: { id: number }
  backgroundColor: string
}

export interface KanbanStatusLabel {
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

export interface KanbanAdminColumn {
  statusId: number
  code: string
  title: string
  colorId: number | null
  backgroundColor: string
  selectedLanguageId: number
  labels: KanbanAdminLabel[]
}

export interface KanbanAdminLabel {
  languageId: number
  labelId: number | null
  label: string
}

export interface KanbanAdminConfig {
  languages: Language[]
  columns: KanbanAdminColumn[]
}

const ADMIN_DEFAULTS: Record<KanbanColumnId, { title: string; color: string; label: string }> = {
  new: { title: 'Nouveau', color: '#dbeafe', label: 'Vaovao' },
  progress: { title: 'In progress', color: '#fde9cf', label: 'Efa manao' },
  done: { title: 'Terminé', color: '#d6f0dd', label: 'Vita' },
}

function codeToColId(code: string): KanbanColumnId | null {
  const normalized = code.toUpperCase().replace(/-/g, '_')
  if (normalized === 'NEW') return 'new'
  if (normalized === 'IN_PROGRESS') return 'progress'
  if (normalized === 'DONE') return 'done'
  return null
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) throw new Error(`Erreur ${res.status} — ${path}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Récupère la liste des langues actives disponibles. */
export async function chargerLangues(): Promise<Language[]> {
  try {
    const langs = await apiFetch<Language[]>('/languages')
    return langs.filter((language) => language.isActive !== 0)
  } catch {
    return []
  }
}

/** Charge la couleur et le libellé localisé de chaque colonne du Kanban front. */
export async function chargerConfigKanban(
  langId: number | null,
): Promise<Partial<Record<KanbanColumnId, KanbanColumnConfig>>> {
  try {
    const statuses = await apiFetch<KanbanStatusApi[]>('/kanban-statuses')
    const activeStatuses = statuses.filter((status) => status.isActive !== 0)

    const configs = await Promise.all(
      activeStatuses.map(async (status) => {
        const colId = codeToColId(status.code)
        if (!colId) return null

        const [colors, labels] = await Promise.all([
          apiFetch<KanbanStatusColor[]>(`/kanban-status-colors/by-status/${status.id}`)
            .catch(() => [] as KanbanStatusColor[]),
          langId !== null
            ? apiFetch<KanbanStatusLabel[]>(`/kanban-status-labels/by-status/${status.id}`)
              .catch(() => [] as KanbanStatusLabel[])
            : Promise.resolve([] as KanbanStatusLabel[]),
        ])

        const backgroundColor = colors.sort((a, b) => a.id - b.id)[0]?.backgroundColor ?? null
        const label = langId !== null
          ? (labels.sort((a, b) => a.id - b.id)
            .find((item) => item.language?.id === langId)?.label ?? null)
          : null

        return { colId, backgroundColor, label }
      }),
    )

    const result: Partial<Record<KanbanColumnId, KanbanColumnConfig>> = {}
    for (const config of configs) {
      if (config) result[config.colId] = {
        backgroundColor: config.backgroundColor,
        label: config.label,
      }
    }
    return result
  } catch {
    return {}
  }
}

/** Charge les valeurs modifiables depuis le back-office. */
export async function chargerConfigurationAdminKanban(): Promise<KanbanAdminConfig> {
  const [statuses, languages, colors, labels] = await Promise.all([
    apiFetch<KanbanStatusApi[]>('/kanban-statuses'),
    apiFetch<Language[]>('/languages'),
    apiFetch<KanbanStatusColor[]>('/kanban-status-colors'),
    apiFetch<KanbanStatusLabel[]>('/kanban-status-labels'),
  ])

  const activeLanguages = languages
    .filter((language) => language.isActive !== 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  const defaultLanguage = activeLanguages.find((language) => language.code.toLowerCase() === 'mg')
    ?? activeLanguages[0]
  if (!defaultLanguage) throw new Error('Aucune langue active n’est disponible.')

  const colorsById = [...colors].sort((a, b) => a.id - b.id)
  const labelsById = [...labels].sort((a, b) => a.id - b.id)
  const columns = statuses
    .filter((status) => status.isActive !== 0 && codeToColId(status.code) !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((status): KanbanAdminColumn => {
      const colId = codeToColId(status.code)!
      const defaults = ADMIN_DEFAULTS[colId]
      const color = colorsById.find((item) => item.status?.id === status.id)
      const columnLabels = activeLanguages.map((language): KanbanAdminLabel => {
        const existing = labelsById.find(
          (item) => item.status?.id === status.id && item.language?.id === language.id,
        )
        const defaultLabel = language.code.toLowerCase() === 'mg' ? defaults.label : ''
        return {
          languageId: language.id,
          labelId: existing?.id ?? null,
          label: existing?.label ?? defaultLabel,
        }
      })

      return {
        statusId: status.id,
        code: status.code,
        title: defaults.title,
        colorId: color?.id ?? null,
        backgroundColor: color?.backgroundColor ?? defaults.color,
        selectedLanguageId: defaultLanguage.id,
        labels: columnLabels,
      }
    })

  return { languages: activeLanguages, columns }
}

/** Crée ou met à jour les couleurs et les libellés localisés des trois colonnes. */
export async function enregistrerConfigurationAdminKanban(
  config: KanbanAdminConfig,
): Promise<KanbanAdminConfig> {
  await Promise.all(config.columns.map(async (column) => {
    const colorPath = column.colorId === null
      ? '/kanban-status-colors'
      : `/kanban-status-colors/${column.colorId}`

    await Promise.all([
      apiFetch<KanbanStatusColor>(colorPath, {
        method: column.colorId === null ? 'POST' : 'PUT',
        body: JSON.stringify({
          status: { id: column.statusId },
          backgroundColor: column.backgroundColor,
        }),
      }),
      ...column.labels
        .filter((item) => item.label.trim() !== '')
        .map((item) => {
          const labelPath = item.labelId === null
            ? '/kanban-status-labels'
            : `/kanban-status-labels/${item.labelId}`
          return apiFetch<KanbanStatusLabel>(labelPath, {
            method: item.labelId === null ? 'POST' : 'PUT',
            body: JSON.stringify({
              status: { id: column.statusId },
              language: { id: item.languageId },
              label: item.label.trim(),
            }),
          })
        }),
    ])
  }))

  const saved = await chargerConfigurationAdminKanban()
  return {
    ...saved,
    columns: saved.columns.map((column) => ({
      ...column,
      selectedLanguageId: config.columns.find((item) => item.statusId === column.statusId)
        ?.selectedLanguageId ?? column.selectedLanguageId,
    })),
  }
}
