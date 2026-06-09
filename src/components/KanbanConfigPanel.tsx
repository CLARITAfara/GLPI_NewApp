import { useCallback, useEffect, useState } from 'react'
import {
  chargerConfigurationAdminKanban,
  enregistrerConfigurationAdminKanban,
} from '../services/kanbanConfigApi'
import type { KanbanAdminColumn, KanbanAdminConfig } from '../services/kanbanConfigApi'

type LoadStatus = 'loading' | 'ready' | 'saving' | 'error'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function KanbanConfigPanel() {
  const [config, setConfig] = useState<KanbanAdminConfig | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    setMessage('')
    try {
      setConfig(await chargerConfigurationAdminKanban())
      setStatus('ready')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Chargement de la configuration impossible.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    chargerConfigurationAdminKanban()
      .then((nextConfig) => {
        if (!active) return
        setConfig(nextConfig)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (!active) return
        setMessage(e instanceof Error ? e.message : 'Chargement de la configuration impossible.')
        setStatus('error')
      })
    return () => { active = false }
  }, [])

  function modifier(statusId: number, patch: Partial<KanbanAdminColumn>) {
    setConfig((current) => current && ({
      ...current,
      columns: current.columns.map((column) => (
        column.statusId === statusId ? { ...column, ...patch } : column
      )),
    }))
    setMessage('')
  }

  function modifierLibelle(statusId: number, label: string) {
    setConfig((current) => current && ({
      ...current,
      columns: current.columns.map((column) => (
        column.statusId === statusId
          ? {
            ...column,
            labels: column.labels.map((item) => (
              item.languageId === column.selectedLanguageId ? { ...item, label } : item
            )),
          }
          : column
      )),
    }))
    setMessage('')
  }

  async function enregistrer() {
    if (!config) return
    if (config.columns.length !== 3) {
      setMessage('Les trois statuts Kanban actifs sont requis.')
      setStatus('error')
      return
    }
    if (config.columns.some((column) => !HEX_COLOR.test(column.backgroundColor))) {
      setMessage('Chaque couleur doit être au format hexadécimal, par exemple #dbeafe.')
      setStatus('error')
      return
    }
    if (config.columns.some((column) => (
      !column.labels.find((item) => item.languageId === column.selectedLanguageId)?.label.trim()
    ))) {
      setMessage('Chaque statut doit avoir un nom dans la langue sélectionnée.')
      setStatus('error')
      return
    }

    setStatus('saving')
    setMessage('')
    try {
      setConfig(await enregistrerConfigurationAdminKanban(config))
      setMessage('Configuration Kanban enregistrée.')
      setStatus('ready')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.')
      setStatus('error')
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Kanban</h2>
        {config && <span className="count-badge">{config.columns.length} colonnes</span>}
      </div>

      <p className="muted kanban-config-intro">
        Personnalisez la couleur de fond des colonnes et leurs noms dans chaque langue.
      </p>

      {status === 'loading' && <p className="muted">Chargement en cours…</p>}
      {status === 'error' && !config && (
        <>
          <p className="login-error" role="alert">{message}</p>
          <button type="button" className="btn-ghost" onClick={load}>Réessayer</button>
        </>
      )}

      {config && (
        <>
          <div className="kanban-config-grid">
            {config.columns.map((column) => {
              const previewColor = HEX_COLOR.test(column.backgroundColor)
                ? column.backgroundColor
                : '#eef2f7'
              const selectedLanguage = config.languages.find(
                (language) => language.id === column.selectedLanguageId,
              )
              const selectedLabel = column.labels.find(
                (item) => item.languageId === column.selectedLanguageId,
              )

              return (
                <article className="kanban-config-card" key={column.statusId}>
                  <div className="kanban-config-preview" style={{ backgroundColor: previewColor }}>
                    <strong>{selectedLabel?.label.trim() || column.title}</strong>
                    <span>{column.title}</span>
                  </div>

                  <div className="kanban-config-fields">
                    <span className="kanban-config-code">{column.code}</span>

                    <label className="kanban-config-field">
                      <span>Couleur de fond</span>
                      <span className="kanban-color-control">
                        <input
                          type="color"
                          value={previewColor}
                          onChange={(e) => modifier(column.statusId, { backgroundColor: e.target.value })}
                          disabled={status === 'saving'}
                          aria-label={`Couleur de ${column.title}`}
                        />
                        <input
                          type="text"
                          value={column.backgroundColor}
                          onChange={(e) => modifier(column.statusId, { backgroundColor: e.target.value })}
                          disabled={status === 'saving'}
                          maxLength={7}
                          placeholder="#dbeafe"
                        />
                      </span>
                    </label>

                    <label className="kanban-config-field">
                      <span>Langue du libellé</span>
                      <select
                        value={column.selectedLanguageId}
                        onChange={(e) => modifier(column.statusId, {
                          selectedLanguageId: Number(e.target.value),
                        })}
                        disabled={status === 'saving'}
                      >
                        {config.languages.map((language) => (
                          <option key={language.id} value={language.id}>
                            {language.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="kanban-config-field">
                      <span>Nom du statut en {selectedLanguage?.name ?? 'langue sélectionnée'}</span>
                      <input
                        type="text"
                        value={selectedLabel?.label ?? ''}
                        onChange={(e) => modifierLibelle(column.statusId, e.target.value)}
                        disabled={status === 'saving'}
                        maxLength={80}
                        placeholder={`Nom en ${selectedLanguage?.name ?? 'langue sélectionnée'}`}
                      />
                    </label>
                  </div>
                </article>
              )
            })}
          </div>

          {message && (
            <p
              className={`kanban-config-message ${status === 'error' ? 'kanban-config-message--error' : 'kanban-config-message--ok'}`}
              role={status === 'error' ? 'alert' : 'status'}
            >
              {message}
            </p>
          )}

          <div className="kanban-config-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={enregistrer}
              disabled={status === 'saving'}
            >
              {status === 'saving' ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
            <button type="button" className="btn-ghost" onClick={load} disabled={status === 'saving'}>
              Annuler les modifications
            </button>
          </div>
        </>
      )}
    </section>
  )
}
