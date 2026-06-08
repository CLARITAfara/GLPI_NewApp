import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { initFrontSession } from '../../services/frontSession'

type State = 'init' | 'ready' | 'error'

/** Initialise la session front silencieusement — aucune dépendance au AuthContext. */
export function FrontAutoLogin() {
  const [state, setState] = useState<State>('init')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    initFrontSession()
      .then(() => { if (!cancelled) setState('ready') })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Connexion au service échouée.')
          setState('error')
        }
      })
    return () => { cancelled = true }
  }, [])

  if (state === 'init') return <div className="splash">Connexion…</div>
  if (state === 'error') return <div className="splash"><p style={{ color: 'red' }}>{error}</p></div>
  return <Outlet />
}
