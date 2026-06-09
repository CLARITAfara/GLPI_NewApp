import { useEffect, useState } from 'react'
import {
  fetchKanbanSettings,
  saveKanbanSettings,
  type KanbanSetting,
} from '../services/kanbanSettingsApi'

export function BackofficeKanbanSettings() {
  const [settings, setSettings] = useState<KanbanSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchKanbanSettings()
      .then(setSettings)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(
    statusKey: string,
    field: 'status_mg' | 'background_color',
    value: string,
  ) {
    setSettings((prev) =>
      prev.map((s) => (s.status_key === statusKey ? { ...s, [field]: value } : s)),
    )
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const updated = await saveKanbanSettings(settings)
      setSettings(updated)
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Chargement…</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>🎨 Personnalisation du Kanban</h2>
      </div>

      <p className="muted" style={{ marginBottom: 20 }}>
        Configurez la couleur de fond et le nom malgache de chaque colonne Kanban.
        La prévisualisation se met à jour en temps réel.
      </p>

      {error && <p className="reset-msg reset-msg--err">{error}</p>}
      {success && (
        <p className="reset-msg reset-msg--ok">Paramètres enregistrés avec succès.</p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="kanban-settings-grid">
          {settings.map((s) => (
            <div key={s.status_key} className="kanban-settings-card">
              {/* Prévisualisation temps réel */}
              <div
                className="kanban-preview-col"
                style={{ backgroundColor: s.background_color }}
              >
                <span className="kanban-preview-title">
                  {s.status_mg || s.status_fr}
                </span>
                <div className="kanban-preview-tickets">
                  <div className="kanban-preview-ticket" />
                  <div className="kanban-preview-ticket kanban-preview-ticket--short" />
                </div>
              </div>

              {/* Champs éditables */}
              <div className="kanban-settings-fields">
                <label className="kanban-field-label">
                  Nom français
                  <input
                    type="text"
                    value={s.status_fr}
                    readOnly
                    className="kanban-input kanban-input--readonly"
                  />
                </label>

                <label className="kanban-field-label">
                  Nom en malgache
                  <input
                    type="text"
                    value={s.status_mg}
                    onChange={(e) => handleChange(s.status_key, 'status_mg', e.target.value)}
                    className="kanban-input"
                    placeholder="ex : Vaovao"
                  />
                </label>

                <label className="kanban-field-label">
                  Couleur de fond
                  <div className="kanban-color-row">
                    <input
                      type="color"
                      value={s.background_color}
                      onChange={(e) =>
                        handleChange(s.status_key, 'background_color', e.target.value)
                      }
                      className="kanban-color-picker"
                    />
                    <span className="kanban-color-hex muted">{s.background_color}</span>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="kanban-settings-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
          </button>
        </div>
      </form>
    </section>
  )
}
