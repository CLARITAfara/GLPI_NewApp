import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { FrontLayout } from './components/front/FrontLayout'
import { FrontAutoLogin } from './components/front/FrontAutoLogin'
import { ElementsPanel } from './components/front/ElementsPanel'
import { CreateTicketPanel } from './components/front/CreateTicketPanel'
import { KanbanBoard } from './components/front/KanbanBoard'
import './App.css'

const ADMIN_PROFILES = ['Super-Admin', 'Admin', 'Supervisor']

export default function App() {
  const { status, session } = useAuth()

  if (status === 'loading') {
    return <div className="splash">Chargement…</div>
  }

  const isAdmin = ADMIN_PROFILES.includes(session?.active_profile?.name ?? '')

  // Élément du back-office, protégé : redirige selon l'état d'authentification.
  // Réutilisé par la racine /admin ET la route par onglet (/admin/:section) pour
  // que chaque onglet ait sa propre URL.
  const backOffice =
    status !== 'authenticated' ? (
      <Navigate to="/login" replace />
    ) : !isAdmin ? (
      <Navigate to="/" replace />
    ) : (
      <DashboardPage />
    )

  return (
    <Routes>
      {/* Login back-office (admin uniquement) — déjà connecté → /admin */}
      <Route
        path="/login"
        element={
          status === 'authenticated' && isAdmin
            ? <Navigate to="/admin" replace />
            : <LoginPage />
        }
      />

      {/* Back-office (admin) — une URL par onglet : /admin, /admin/tickets… */}
      <Route path="/admin" element={backOffice} />
      <Route path="/admin/:section" element={backOffice} />

      {/* Front-office À LA RACINE — point d'entrée par défaut de l'app.
          Session propre (auto-login), aucun compte visible. */}
      <Route path="/" element={<FrontAutoLogin />}>
        <Route element={<FrontLayout />}>
          <Route index element={<ElementsPanel />} />
          <Route path="kanban" element={<KanbanBoard />} />
          <Route path="tickets/create" element={<CreateTicketPanel />} />
        </Route>
      </Route>

      {/* Catch-all → front-office */}
      <Route path="/*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
