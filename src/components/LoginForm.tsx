import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { config } from '../config'

export function LoginForm() {
  const { login, error } = useAuth()
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
    <div className="card login-card shadow-lg">
      <div className="text-center mb-4">
        <div className="login-logo">
          <i className="bi bi-lock-fill" aria-hidden="true" />
        </div>

        <h1 className="h3 mb-2">Connexion GLPI</h1>

        <p className="text-muted">
          Entrez votre code d'accès
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="code" className="form-label">
            Code d'accès
          </label>

          <input
            id="code"
            type="password"
            className="form-control"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary w-100 btn-login"
          disabled={submitting || !code}
        >
          {submitting ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              />
              Connexion...
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>
    </div>
  </div>
)
}
