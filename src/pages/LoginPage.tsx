import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../services/AuthService';

const authService = new AuthService();

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.login(username, password);
      navigate('/home');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Identifiants incorrects ou serveur inaccessible.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>GLPI</h1>
        <p style={styles.subtitle}>Connexion à votre espace</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="username">Identifiant</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Votre identifiant"
              required
              autoComplete="username"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Votre mot de passe"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a2744 0%, #2d5aa0 100%)',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '2rem',
    fontWeight: 700,
    color: '#1a2744',
    textAlign: 'center',
    letterSpacing: '2px',
  },
  subtitle: {
    margin: '0 0 32px',
    fontSize: '0.9rem',
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '10px 14px',
    fontSize: '0.95rem',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
    color: '#111827',
  },
  error: {
    margin: 0,
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.85rem',
  },
  button: {
    padding: '12px',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#ffffff',
    background: '#2d5aa0',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: '4px',
  },
};

export default LoginPage;
