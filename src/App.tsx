import { useAuth } from './auth/AuthContext'
import { LoginForm } from './components/LoginForm'
import { Dashboard } from './components/Dashboard'
import './App.css'

function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="splash">Chargement…</div>
  }

  return status === 'authenticated' ? <Dashboard /> : <LoginForm />
}

export default App
