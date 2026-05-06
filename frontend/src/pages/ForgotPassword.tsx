import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { sanitizeEmail, isValidEmail } from '../utils/sanitize';
import styles from './Auth.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(''); setMessage('');
    const clean = sanitizeEmail(email);
    if (!isValidEmail(clean)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', { email: clean });
      setMessage(res.data.message);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>Forgot Password</h2>
        <p className={styles.sub}>Enter your email and we'll send a reset link</p>
        {message ? (
          <div style={{ color: 'green', marginBottom: '1rem' }}>{message}</div>
        ) : (
          <form onSubmit={submit} autoComplete="on">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" maxLength={254} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        <p className={styles.switch}><Link to="/login">Back to Login</Link></p>
      </div>
    </div>
  );
}
