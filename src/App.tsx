import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { FrontLayout } from './components/front/FrontLayout'
import { FrontAutoLogin } from './components/front/FrontAutoLogin'
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

  return (
    <Routes>
      {/* Login back-office (admin uniquement) */}
      <Route
        path="/login"
        element={
          status === 'authenticated' && isAdmin
            ? <Navigate to="/" replace />
            : <LoginPage />
        }
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

      {/* Front-office — session propre, pas de user connecté visible */}
      <Route path="/front" element={<FrontAutoLogin />}>
        <Route element={<FrontLayout />}>
          <Route index element={<ElementsPanel />} />
          <Route path="tickets/create" element={<CreateTicketPanel />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="/*" element={<Navigate to="/front" replace />} />
    </Routes>
  )
}
