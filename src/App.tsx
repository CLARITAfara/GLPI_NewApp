import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { FrontPage } from './pages/FrontPage'
import './App.css'

const ADMIN_PROFILES = ['Super-Admin', 'Admin', 'Supervisor']

export default function App() {
  const { status, session } = useAuth()

  if (status === 'loading') {
    return <div className="splash">Chargement…</div>
  }

  const isAdmin = ADMIN_PROFILES.includes(session?.active_profile?.name ?? '')
  const home = isAdmin ? '/' : '/front'

  return (
    <Routes>
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to={home} replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          status !== 'authenticated' ? (
            <Navigate to="/login" replace />
          ) : !isAdmin ? (
            <Navigate to="/front" replace />
          ) : (
            <DashboardPage />
          )
        }
      />
      <Route
        path="/front"
        element={
          status !== 'authenticated' ? (
            <Navigate to="/login" replace />
          ) : isAdmin ? (
            <Navigate to="/" replace />
          ) : (
            <FrontPage />
          )
        }
      />
      <Route
        path="/*"
        element={
          status !== 'authenticated' ? (
            <Navigate to="/login" replace />
          ) : (
            <Navigate to={home} replace />
          )
        }
      />
    </Routes>
  )
}
