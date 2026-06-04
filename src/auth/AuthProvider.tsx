import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthStatus } from './AuthContext'
import type { Session } from '../api/types'
import { getSession, login as apiLogin, logout as apiLogout } from '../api/auth'
import { getTokens } from '../api/tokenStore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function restore() {
      if (!getTokens()) {
        if (active) setStatus('unauthenticated')
        return
      }
      try {
        const s = await getSession()
        if (!active) return
        setSession(s)
        setStatus('authenticated')
      } catch {
        if (!active) return
        apiLogout()
        setStatus('unauthenticated')
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setError(null)
    try {
      await apiLogin(username, password)
      const s = await getSession()
      setSession(s)
      setStatus('authenticated')
    } catch (e) {
      apiLogout()
      setSession(null)
      setStatus('unauthenticated')
      const msg = e instanceof Error ? e.message : 'Échec de la connexion.'
      setError(msg)
      throw e
    }
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setSession(null)
    setStatus('unauthenticated')
    setError(null)
  }, [])

  return (
    <AuthContext value={{ status, session, error, login, logout }}>
      {children}
    </AuthContext>
  )
}
