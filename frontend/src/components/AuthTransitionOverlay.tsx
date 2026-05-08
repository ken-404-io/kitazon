import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AuthTransitionOverlay.module.css';

export default function AuthTransitionOverlay() {
  const { authTransition } = useAuth();
  const [show, setShow]     = useState(false);
  const [fading, setFading] = useState(false);
  // Ref tracks whether the overlay is currently mounted so the idle-branch
  // inside the effect doesn't need `show` as a dependency.
  const mountedRef = useRef(false);

  useEffect(() => {
    if (authTransition !== 'idle') {
      mountedRef.current = true;
      setFading(false);
      setShow(true);
    } else if (mountedRef.current) {
      setFading(true);
      const t = setTimeout(() => {
        mountedRef.current = false;
        setShow(false);
      }, 480);
      return () => clearTimeout(t);
    }
  }, [authTransition]);

  if (!show) return null;

  const label = authTransition === 'signing-out' ? 'Signing out…' : 'Signing in…';
  const sub   = authTransition === 'signing-out' ? 'See you soon' : 'Welcome back';

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
