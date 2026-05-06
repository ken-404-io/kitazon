import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

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

      {/* Overlay */}
      {open && <div className={styles.overlay} onClick={close} />}
    </nav>
  );
}
