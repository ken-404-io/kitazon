import { useLocation } from 'react-router-dom';
import styles from './FacebookFab.module.css';

export const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/1DSY4y87SR/?mibextid=wwXIfr';

export default function FacebookFab() {
  const { pathname } = useLocation();

  // Hide on auth-flow / fullscreen pages where it would obscure forms
  if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') {
    return null;
  }

  return (
    <a
      href={FACEBOOK_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.fab}
      aria-label="Visit our Facebook Page"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"/>
      </svg>
      <span className={styles.tooltip}>Like our Facebook Page</span>
    </a>
  );
}
