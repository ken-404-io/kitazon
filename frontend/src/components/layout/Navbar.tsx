import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
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
