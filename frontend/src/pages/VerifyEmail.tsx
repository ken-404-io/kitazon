import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import styles from './Auth.module.css';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('No verification token provided.'); return; }

    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => { setStatus('success'); setMessage(res.data.message); })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message ?? 'Verification failed. The link may have expired.');
      });
  }, [params]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {status === 'loading' && <p>Verifying your email...</p>}
        {status === 'success' && (
          <>
            <h2>Email Verified!</h2>
            <p>{message}</p>
            <Link to="/dashboard"><button className="btn-primary" style={{ width: '100%' }}>Go to Dashboard</button></Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2>Verification Failed</h2>
            <p className="error-msg">{message}</p>
            <Link to="/dashboard"><button className="btn-primary" style={{ width: '100%' }}>Back to Dashboard</button></Link>
          </>
        )}
      </div>
    </div>
  );
}
