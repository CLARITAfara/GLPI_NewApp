import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import './App.css'

export default function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="splash">Chargement…</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={status === 'authenticated' ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}
