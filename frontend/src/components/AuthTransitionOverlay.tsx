import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AuthTransitionOverlay.module.css';

export default function AuthTransitionOverlay() {
  const { authTransition } = useAuth();
  const [show, setShow]     = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (authTransition !== 'idle') {
      setFading(false);
      setShow(true);
    } else if (show) {
      setFading(true);
      const t = setTimeout(() => setShow(false), 480);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authTransition]);

  if (!show) return null;

  const label = authTransition === 'signing-out' ? 'Signing out…' : 'Signing in…';
  const sub   = authTransition === 'signing-out' ? 'See you soon'  : 'Welcome back';

  return (
    <div className={`${styles.overlay} ${fading ? styles.fadeOut : styles.fadeIn}`}>
      <div className={styles.box}>
        <div className={styles.ring}>
          <span className={styles.logo}>K</span>
        </div>
        <p className={styles.label}>{label}</p>
        <p className={styles.sub}>{sub}</p>
      </div>
    </div>
  );
}
