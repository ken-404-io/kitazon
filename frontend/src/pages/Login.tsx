import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../context/AuthContext';
import { sanitizeEmail, isValidEmail } from '../utils/sanitize';
import styles from './Auth.module.css';

const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY ?? '';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

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
      let captchaToken: string | undefined;
      if (HCAPTCHA_SITE_KEY) {
        const result = await captchaRef.current?.execute({ async: true });
        captchaToken = result?.response;
      }
      await login(email, form.password, captchaToken);
    } catch (err: unknown) {
      captchaRef.current?.resetCaptcha();
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
          {HCAPTCHA_SITE_KEY && (
            <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITE_KEY} size="invisible" />
          )}
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className={styles.switch}><Link to="/forgot-password">Forgot password?</Link></p>
        <p className={styles.switch}>No account? <Link to="/register">Join free</Link></p>
      </div>
    </div>
  );
}
