import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { Withdrawal } from '../../types';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Withdrawal[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('seenWithdrawals') ?? '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (!user) return;
    const poll = () => {
      api.get<Withdrawal[]>('/withdrawals').then((r) => setNotifications(r.data)).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [user]);

  const unread = notifications.filter((n) => !seenIds.includes(n.id) && n.status !== 'pending').length;

  const markAllRead = () => {
    const ids = notifications.map((n) => n.id);
    setSeenIds(ids);
    localStorage.setItem('seenWithdrawals', JSON.stringify(ids));
  };

  const close = () => setOpen(false);

  const handleLogout = async (): Promise<void> => {
    close();
    await logout();
    navigate('/');
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.brand} onClick={close}>💰 Kitazon</Link>

      {/* Hamburger */}
      <button className={styles.hamburger} onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
        <span className={`${styles.bar} ${open ? styles.barTop : ''}`} />
        <span className={`${styles.bar} ${open ? styles.barMid : ''}`} />
        <span className={`${styles.bar} ${open ? styles.barBot : ''}`} />
      </button>

      {/* Links */}
      <div className={`${styles.links} ${open ? styles.linksOpen : ''}`}>
        <Link to="/payout-proof" onClick={close}>Payout Proof</Link>
        <Link to="/leaderboard" onClick={close}>Leaderboard</Link>
        {user ? (
          <>
            <Link to="/dashboard" onClick={close}>Dashboard</Link>
            <Link to="/tasks" onClick={close}>Tasks</Link>
            <Link to="/referral" onClick={close}>Referral</Link>
            <Link to="/account" onClick={close} style={{ position: 'relative' }}>
              Settings
              {!user.email_verified && (
                <span
                  title="Email not verified — withdrawals disabled"
                  style={{
                    position: 'absolute', top: -6, right: -10,
                    background: '#f59e0b', color: '#000',
                    borderRadius: '50%', width: 16, height: 16,
                    fontSize: 10, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >!</span>
              )}
            </Link>
            {user.is_admin && <Link to="/admin" onClick={close}>Admin</Link>}
            <Link to="/withdraw" onClick={close}>
              <button className="btn-primary">Withdraw</button>
            </Link>
            <button className="btn-outline" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={close}>Login</Link>
            <Link to="/register" onClick={close}><button className="btn-primary">Join Free</button></Link>
          </>
        )}
      </div>

      {/* Theme + Notification controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4 }}
          aria-label="Toggle theme"
        >{theme === 'dark' ? '☀️' : '🌙'}</button>

        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setNotifOpen((o) => !o); if (!notifOpen) markAllRead(); }}
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4 }}
              aria-label="Notifications"
            >🔔</button>
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
            )}
            {notifOpen && (
              <div style={{ position: 'absolute', right: 0, top: '120%', background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 10, width: 300, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--dark-border)', fontWeight: 700, fontSize: 14 }}>Withdrawal Updates</div>
                {notifications.filter((n) => n.status !== 'pending').length === 0 ? (
                  <p style={{ padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>No updates yet.</p>
                ) : notifications.filter((n) => n.status !== 'pending').slice(0, 8).map((n) => (
                  <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--dark-border)', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: n.status === 'completed' ? '#16a34a' : n.status === 'failed' ? '#dc2626' : '#2563eb' }}>{n.status.toUpperCase()}</span>
                    {' — '}₱{Number(n.net_amount).toFixed(2)} via {n.channel.toUpperCase()}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(n.created_at).toLocaleString('en-PH')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay */}
      {(open || notifOpen) && <div className={styles.overlay} onClick={() => { close(); setNotifOpen(false); }} />}
    </nav>
  );
}
