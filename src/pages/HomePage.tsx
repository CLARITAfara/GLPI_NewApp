import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { UserSession } from '../models/UserSession';

const authService = new AuthService();

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const current = authService.getCurrentSession();
    if (!current) {
      navigate('/');
      return;
    }
    setSession(current);
  }, [navigate]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await authService.logout();
    navigate('/');
  };

  if (!session) return null;

  const displayName = session.userName ?? 'Utilisateur';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.badge}>GLPI</div>
        <h1 style={styles.welcome}>Bienvenue dans GLPI</h1>
        <p style={styles.user}>
          Connecté en tant que{' '}
          <span style={styles.userName}>{displayName}</span>
        </p>

        <div style={styles.divider} />

        <p style={styles.info}>
          Vous êtes authentifié avec succès. Votre session est active.
        </p>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={styles.logoutButton}
        >
          {loggingOut ? 'Déconnexion...' : 'Déconnexion'}
        </button>
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
    maxWidth: '440px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 20px',
    background: '#1a2744',
    color: '#ffffff',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '2px',
    marginBottom: '24px',
  },
  welcome: {
    margin: '0 0 12px',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1a2744',
  },
  user: {
    margin: '0 0 4px',
    fontSize: '1rem',
    color: '#6b7280',
  },
  userName: {
    fontWeight: 600,
    color: '#2d5aa0',
  },
  divider: {
    margin: '28px 0',
    height: '1px',
    background: '#e5e7eb',
  },
  info: {
    margin: '0 0 28px',
    fontSize: '0.9rem',
    color: '#9ca3af',
    lineHeight: 1.6,
  },
  logoutButton: {
    padding: '12px 32px',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#dc2626',
    background: '#fef2f2',
    border: '1.5px solid #fca5a5',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

export default HomePage;
