import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/');
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.brand}>💰 Kitazon</Link>
      <div className={styles.links}>
        <Link to="/payout-proof">Payout Proof</Link>
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/tasks">Tasks</Link>
            <Link to="/referral">Referral</Link>
            <Link to="/account" style={{ position: 'relative' }}>
              Settings
              {!user.email_verified && (
                <span
                  title="Email not verified — withdrawals disabled"
                  style={{
                    position: 'absolute', top: -6, right: -10,
                    background: '#f59e0b', color: '#000',
                    borderRadius: '50%', width: 16, height: 16,
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >!</span>
              )}
            </Link>
            {user.is_admin && <Link to="/admin">Admin</Link>}
            <Link to="/withdraw">
              <button className="btn-primary">Withdraw</button>
            </Link>
            <button className="btn-outline" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register"><button className="btn-primary">Join Free</button></Link>
          </>
        )}
      </div>
    </nav>
  );
}
