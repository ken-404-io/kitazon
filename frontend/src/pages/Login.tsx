import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sanitizeEmail, isValidEmail } from '../utils/sanitize';
import styles from './Auth.module.css';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    const email = sanitizeEmail(form.email);
    if (!isValidEmail(email)) return setError('Invalid email address.');
    if (!form.password) return setError('Password is required.');

    setLoading(true);
    try {
      await login(email, form.password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>Welcome back 👋</h2>
        <p className={styles.sub}>Login to your Kitazon account</p>
        <form onSubmit={submit} autoComplete="on">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required autoFocus autoComplete="email" maxLength={254} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} required autoComplete="current-password" maxLength={128} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className={styles.switch}>No account? <Link to="/register">Join free</Link></p>
      </div>
    </div>
  );
}
