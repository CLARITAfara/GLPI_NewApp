import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { config } from '../config'

export function LoginForm() {
  const { login, error } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState(config.glpiPassword)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(config.glpiUsername, code)
    } catch {
      // l'erreur est exposée via le contexte (error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-layout">
        <div className="login-brand-panel">
          <div className="login-brand-content">
            <div className="login-brand-logo">
              <i className="bi bi-shield-lock" aria-hidden="true" />
            </div>
            <h2>GLPI Admin</h2>
            <p>Plateforme de gestion informatique</p>
            <ul className="login-features">
              <li><i className="bi bi-ticket-perforated" aria-hidden="true" /> Gestion des tickets</li>
              <li><i className="bi bi-kanban" aria-hidden="true" /> Tableau Kanban</li>
              <li><i className="bi bi-bar-chart-line" aria-hidden="true" /> Statistiques avancées</li>
              <li><i className="bi bi-upload" aria-hidden="true" /> Import de données</li>
            </ul>
          </div>
        </div>

        <div className="login-form-panel">
          <form className="login-card" onSubmit={handleSubmit}>
            <h1>Connexion</h1>
            <p className="subtitle">Espace d'administration GLPI — entrez votre code d'accès.</p>

            <label htmlFor="code">Code d'accès</label>
            <input
              id="code"
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || !code}>
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>

            <button
              type="button"
              className="login-back"
              onClick={() => navigate('/')}
            >
              ← Retour à l'espace utilisateur
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
