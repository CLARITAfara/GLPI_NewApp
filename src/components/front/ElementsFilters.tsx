import { ALL_ITEM_TYPES } from '../../services/elementsApi'
import type { ElementFilters } from '../../services/elementsApi'

interface FilterOptions {
  statuses: string[]
  locations: string[]
  manufacturers: string[]
  models: string[]
  users: string[]
}

interface Props {
  filters: ElementFilters
  onChange: (filters: ElementFilters) => void
  onReset: () => void
  onRefresh: () => void
  loading: boolean
  options: FilterOptions
}

export function ElementsFilters({ filters, onChange, onReset, onRefresh, loading, options }: Props) {
  function set(field: keyof ElementFilters, value: string) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <div className="elements-filters">
      <div className="filters-grid">

        <div className="filter-field">
          <label htmlFor="ef-name">Nom</label>
          <input
            id="ef-name"
            type="text"
            value={filters.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Rechercher par nom…"
          />
        </div>

        <div className="filter-field">
          <label htmlFor="ef-status">Statut</label>
          <select id="ef-status" value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Tous les statuts</option>
            {options.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ef-location">Localisation</label>
          <select id="ef-location" value={filters.location} onChange={(e) => set('location', e.target.value)}>
            <option value="">Toutes les localisations</option>
            {options.locations.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ef-manufacturer">Fabricant</label>
          <select id="ef-manufacturer" value={filters.manufacturer} onChange={(e) => set('manufacturer', e.target.value)}>
            <option value="">Tous les fabricants</option>
            {options.manufacturers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ef-itemtype">Type d'élément</label>
          <select id="ef-itemtype" value={filters.itemType} onChange={(e) => set('itemType', e.target.value)}>
            <option value="">Tous les types</option>
            {ALL_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ef-model">Modèle</label>
          <select id="ef-model" value={filters.model} onChange={(e) => set('model', e.target.value)}>
            <option value="">Tous les modèles</option>
            {options.models.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ef-inventory">N° inventaire</label>
          <input
            id="ef-inventory"
            type="text"
            value={filters.inventoryNumber}
            onChange={(e) => set('inventoryNumber', e.target.value)}
            placeholder="Rechercher…"
          />
        </div>

        <div className="filter-field">
          <label htmlFor="ef-user">Utilisateur</label>
          <select id="ef-user" value={filters.user} onChange={(e) => set('user', e.target.value)}>
            <option value="">Tous les utilisateurs</option>
            {options.users.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

      </div>

      <div className="filters-actions">
        <button type="button" className="btn-ghost" onClick={onReset} disabled={loading}>
          Réinitialiser
        </button>
        <button type="button" className="btn-ghost" onClick={onRefresh} disabled={loading}>
          ↺ Actualiser
        </button>
      </div>
    </div>
  )
}
