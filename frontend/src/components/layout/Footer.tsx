import { Link, useLocation } from 'react-router-dom';
import { FACEBOOK_PAGE_URL } from '../FacebookFab';
import styles from './Footer.module.css';

export default function Footer() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  return (
    <footer className={`${styles.footer} ${isLanding ? styles.footerVisible : ''}`}>
      <p><strong>Kitazon</strong> — Earn More. Withdraw Faster.</p>
      <p className={styles.sub}>Built in the Philippines, for the Philippines. &copy; {new Date().getFullYear()} Kitazon Technologies Corp.</p>
      <div className={styles.links}>
        <a href="mailto:contact@kitazon.ph">contact@kitazon.ph</a>
        <span>&middot;</span>
        <Link to="/terms">Terms</Link>
        <span>&middot;</span>
        <Link to="/privacy">Privacy</Link>
        <span>&middot;</span>
        <Link to="/leaderboard">Leaderboard</Link>
        <span>&middot;</span>
        <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer">Facebook</a>
      </div>
    </footer>
  );
}

