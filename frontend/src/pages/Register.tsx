import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sanitizeInput, sanitizeEmail, isValidEmail, isStrongPassword } from '../utils/sanitize';
import styles from './Auth.module.css';

interface FormState {
  name: string;
  email: string;
  password: string;
  referral_code: string;
}

export default function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    referral_code: params.get('ref') ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    const name = sanitizeInput(form.name);
    const email = sanitizeEmail(form.email);
    const referral_code = sanitizeInput(form.referral_code);

    if (!name) return setError('Full name is required.');
    if (!isValidEmail(email)) return setError('Invalid email address.');
    const pwError = isStrongPassword(form.password);
    if (pwError) return setError(pwError);

    setLoading(true);
    try {
      await register({ name, email, password: form.password, referral_code });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>Join Kitazon 💰</h2>
        <p className={styles.sub}>Free signup · Start earning today</p>
        <form onSubmit={submit} autoComplete="on">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={form.name} onChange={set('name')} required autoFocus autoComplete="name" maxLength={100} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" maxLength={254} />
          </div>
          <div className="form-group">
            <label>Password (min 8 chars, letters + numbers)</label>
            <input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" maxLength={128} />
          </div>
          <div className="form-group">
            <label>Referral Code (optional)</label>
            <input type="text" value={form.referral_code} onChange={set('referral_code')} autoComplete="off" maxLength={20} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>
        </form>
        <p className={styles.switch}>Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
