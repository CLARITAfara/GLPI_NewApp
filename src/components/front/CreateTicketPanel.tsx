import { useMemo, useState } from 'react'
import {
  createTicketWithItems,
  computePriority,
} from '../../services/ticketCreateApi'
import type { TicketFormData, TicketLevel, TicketType } from '../../services/ticketCreateApi'
import { ItemSelector, itemKey } from './ItemSelector'
import type { ElementRow } from '../../services/elementsApi'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

const LEVELS: { value: TicketLevel; label: string }[] = [
  { value: 1, label: '1 — Très basse' },
  { value: 2, label: '2 — Basse' },
  { value: 3, label: '3 — Moyenne' },
  { value: 4, label: '4 — Haute' },
  { value: 5, label: '5 — Très haute' },
]

interface FormErrors {
  name?: string
  content?: string
}

export function CreateTicketPanel() {
  // Champs du formulaire
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<TicketType>(1)
  const [urgency, setUrgency] = useState<TicketLevel>(3)
  const [impact, setImpact] = useState<TicketLevel>(3)
  const [manualPriority, setManualPriority] = useState<TicketLevel | null>(null)

  // Éléments sélectionnés
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Map<string, ElementRow>>(new Map())

  // Soumission
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [submitError, setSubmitError] = useState('')
  const [ticketId, setTicketId] = useState<number | null>(null)
  const [itemErrors, setItemErrors] = useState(0)

  // Validation
  const [errors, setErrors] = useState<FormErrors>({})

  const autoPriority = useMemo(() => computePriority(urgency, impact), [urgency, impact])
  const priority = manualPriority ?? autoPriority

  function handleUrgencyChange(v: TicketLevel) {
    setUrgency(v)
    setManualPriority(null) // recalcul auto
  }

  function handleImpactChange(v: TicketLevel) {
    setImpact(v)
    setManualPriority(null)
  }

  function handleToggleItem(item: ElementRow) {
    const key = itemKey(item)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setSelectedItems((prev) => {
      const next = new Map(prev)
      next.has(key) ? next.delete(key) : next.set(key, item)
      return next
    })
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Le titre est obligatoire.'
    if (!content.trim()) errs.content = 'La description est obligatoire.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitStatus('loading')
    setSubmitError('')

    const formData: TicketFormData = {
      name: name.trim(),
      content: content.trim(),
      type,
      urgency,
      impact,
      priority,
    }

    const items = [...selectedItems.values()].map((r) => ({
      id: r.id,
      itemType: r.itemType,
    }))

    try {
      const result = await createTicketWithItems(formData, items)
      setTicketId(result.ticketId)
      setItemErrors(result.itemErrors)
      setSubmitStatus('success')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erreur lors de la création du ticket.')
      setSubmitStatus('error')
    }
  }

  function handleReset() {
    setName('')
    setContent('')
    setType(1)
    setUrgency(3)
    setImpact(3)
    setManualPriority(null)
    setSelectedKeys(new Set())
    setSelectedItems(new Map())
    setSubmitStatus('idle')
    setSubmitError('')
    setTicketId(null)
    setItemErrors(0)
    setErrors({})
  }

  // ── Écran succès ──────────────────────────────────────────────────────────
  if (submitStatus === 'success' && ticketId) {
    return (
      <section className="panel">
        <div className="ticket-success">
          <div className="ticket-success-icon">✅</div>
          <h3>Ticket créé avec succès !</h3>
          <p>Ticket n° <strong>{ticketId}</strong> créé.</p>
          {selectedKeys.size > 0 && itemErrors === 0 && (
            <p className="muted" translate="no">
              {`${selectedKeys.size} élément${selectedKeys.size > 1 ? 's' : ''} associé${selectedKeys.size > 1 ? 's' : ''}.`}
            </p>
          )}
          {itemErrors > 0 && (
            <p className="muted" translate="no">
              {`${selectedKeys.size - itemErrors} élément${selectedKeys.size - itemErrors > 1 ? 's' : ''} associé${selectedKeys.size - itemErrors > 1 ? 's' : ''} (${itemErrors} échec${itemErrors > 1 ? 's' : ''} d'association).`}
            </p>
          )}
          <button type="button" className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={handleReset}>
            Créer un autre ticket
          </button>
        </div>
      </section>
    )
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>🎫 Créer un ticket</h2>
      </div>

      <form className="ticket-form" onSubmit={handleSubmit} noValidate>

        {/* Section — Informations */}
        <div className="ticket-section">
          <h3 className="ticket-section-title">Informations</h3>

          <div className="ticket-field">
            <label htmlFor="tk-name">
              Titre <span className="req">*</span>
            </label>
            <input
              id="tk-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }))
              }}
              placeholder="Titre du ticket…"
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="ticket-field">
            <label htmlFor="tk-content">
              Description <span className="req">*</span>
            </label>
            <textarea
              id="tk-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errors.content) setErrors((p) => ({ ...p, content: undefined }))
              }}
              placeholder="Décrivez le problème ou la demande…"
              rows={5}
            />
            {errors.content && <span className="field-error">{errors.content}</span>}
          </div>

          <div className="ticket-field ticket-field--short">
            <label htmlFor="tk-type">Type</label>
            <select
              id="tk-type"
              value={type}
              onChange={(e) => setType(Number(e.target.value) as TicketType)}
            >
              <option value={1}>Incident</option>
              <option value={2}>Demande</option>
            </select>
          </div>
        </div>

        {/* Section — Qualification */}
        <div className="ticket-section">
          <h3 className="ticket-section-title">Qualification</h3>

          <div className="ticket-row">
            <div className="ticket-field">
              <label htmlFor="tk-urgency">Urgence</label>
              <select
                id="tk-urgency"
                value={urgency}
                onChange={(e) => handleUrgencyChange(Number(e.target.value) as TicketLevel)}
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="ticket-field">
              <label htmlFor="tk-impact">Impact</label>
              <select
                id="tk-impact"
                value={impact}
                onChange={(e) => handleImpactChange(Number(e.target.value) as TicketLevel)}
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="ticket-field">
              <label htmlFor="tk-priority">
                Priorité
                {manualPriority === null && (
                  <span className="auto-badge">auto</span>
                )}
              </label>
              <select
                id="tk-priority"
                value={priority}
                onChange={(e) => setManualPriority(Number(e.target.value) as TicketLevel)}
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              {manualPriority !== null && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setManualPriority(null)}
                >
                  ↺ Recalculer automatiquement
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section — Éléments associés */}
        <div className="ticket-section">
          <h3 className="ticket-section-title">
            Éléments associés
            {selectedKeys.size > 0 && (
              <span className="count-badge" style={{ marginLeft: '10px' }}>
                {selectedKeys.size}
              </span>
            )}
          </h3>
          <p className="muted ticket-section-hint">
            Sélectionnez les équipements concernés par ce ticket.
          </p>
          <ItemSelector selected={selectedKeys} onToggle={handleToggleItem} />
        </div>

        {/* Erreur soumission */}
        {submitStatus === 'error' && (
          <p className="login-error" role="alert">{submitError}</p>
        )}

        {/* Actions */}
        <div className="ticket-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={submitStatus === 'loading'}
          >
            {submitStatus === 'loading' ? 'Création en cours…' : 'Créer le ticket'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleReset}
            disabled={submitStatus === 'loading'}
          >
            Réinitialiser
          </button>
        </div>

      </form>
    </section>
  )
}
