import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import styles from './PaymentSuccess.module.css';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [planName, setPlanName] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const orderId = params.get('token');
    const plan    = params.get('plan');

    if (!orderId || !plan) { setStatus('error'); return; }

    api.post('/subscriptions/capture', { orderId, plan })
      .then(async () => {
        await refreshUser();
        setPlanName(plan.charAt(0).toUpperCase() + plan.slice(1));
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 4000);
      })
      .catch(() => setStatus('error'));
  }, [params, navigate, refreshUser]);

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p>Confirming your payment…</p>
          <div className={styles.bar}><div className={styles.barFill} /></div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconErr}>✕</div>
          <h2>Payment Error</h2>
          <p className={styles.sub}>We couldn't confirm your payment. Please contact support if you were charged.</p>
          <Link to="/plans" className={styles.btn}>Back to Plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.confetti}>🎉</div>
        <div className={styles.iconOk}>✓</div>
        <h2>Payment Successful!</h2>
        <p className={styles.sub}>
          Thank you! Your <strong>{planName}</strong> plan is now active.<br />
          Your premium access is now active.
        </p>
        <p className={styles.redirect}>Redirecting you to your dashboard…</p>
        <Link to="/dashboard" className={styles.btn}>Go to Dashboard →</Link>
      </div>
    </div>
  );
}
