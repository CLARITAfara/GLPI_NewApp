import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { FrontLayout } from './components/front/FrontLayout'
import { ElementsPanel } from './components/front/ElementsPanel'
import { CreateTicketPanel } from './components/front/CreateTicketPanel'
import './App.css'

const ADMIN_PROFILES = ['Super-Admin', 'Admin', 'Supervisor']

export default function App() {
  const { status, session } = useAuth()

  if (status === 'loading') {
    return <div className="splash">Chargement…</div>
  }

  const isAdmin = ADMIN_PROFILES.includes(session?.active_profile?.name ?? '')
  const home = isAdmin ? '/' : '/front'

  const frontGuard =
    status !== 'authenticated' ? (
      <Navigate to="/login" replace />
    ) : isAdmin ? (
      <Navigate to="/" replace />
    ) : (
      <FrontLayout />
    )

  return (
    <Routes>
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to={home} replace /> : <LoginPage />}
      />

      {/* Back-office (admin) */}
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

      {/* Front-office (utilisateurs) — routes imbriquées */}
      <Route path="/front" element={frontGuard}>
        <Route index element={<ElementsPanel />} />
        <Route path="tickets/create" element={<CreateTicketPanel />} />
      </Route>

      {/* Catch-all */}
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
