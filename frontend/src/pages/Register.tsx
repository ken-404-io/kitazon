import { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../context/AuthContext';
import {
  sanitizeInput, sanitizeEmail, isStrongPassword,
  validateName, validateEmailField, validatePasswordField,
} from '../utils/sanitize';
import PasswordStrength from '../components/ui/PasswordStrength';
import styles from './Auth.module.css';

const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY ?? '';

interface FormState {
  name: string; email: string; password: string; referral_code: string;
}

export default function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', referral_code: params.get('ref') ?? '',
  });
  const [touched, setTouched] = useState({ name: false, email: false, password: false });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const blur = (f: keyof typeof touched) => () => setTouched(p => ({ ...p, [f]: true }));

  const nameErr     = touched.name     ? validateName(form.name) : null;
  const emailErr    = touched.email    ? validateEmailField(form.email) : null;
  const passwordErr = touched.password ? validatePasswordField(form.password) : null;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    const name  = sanitizeInput(form.name);
    const email = sanitizeEmail(form.email);
    const referral_code = sanitizeInput(form.referral_code);

    if (!name)                            { setTouched(p => ({ ...p, name: true })); return; }
    if (!email || !(validateEmailField(email) === null)) {
      setTouched(p => ({ ...p, email: true }));
      if (validateEmailField(email)) return;
    }
    const pwError = isStrongPassword(form.password);
    if (pwError) { setTouched(p => ({ ...p, password: true })); return; }

    setLoading(true);
    try {
      let captcha_token: string | undefined;
      if (HCAPTCHA_SITE_KEY) {
        const result = await captchaRef.current?.execute({ async: true });
        captcha_token = result?.response;
      }
      await register({ name, email, password: form.password, referral_code, captcha_token });
    } catch (err: unknown) {
      captchaRef.current?.resetCaptcha();
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>Join Kitazon</h2>
        <p className={styles.sub}>Free signup · Start earning today</p>
        <form onSubmit={submit} autoComplete="on" noValidate>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              onBlur={blur('name')}
              className={touched.name ? (nameErr ? 'field-invalid' : 'field-valid') : ''}
              required
              autoFocus
              autoComplete="name"
              maxLength={100}
            />
            {nameErr && <p className="field-hint hint-invalid">{nameErr}</p>}
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              onBlur={blur('email')}
              className={touched.email ? (emailErr ? 'field-invalid' : 'field-valid') : ''}
              required
              autoComplete="email"
              maxLength={254}
            />
            {emailErr && <p className="field-hint hint-invalid">{emailErr}</p>}
          </div>
          <div className="form-group">
            <label>Password (min 8 chars, letters + numbers)</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              onBlur={blur('password')}
              className={touched.password ? (passwordErr ? 'field-invalid' : 'field-valid') : ''}
              required
              autoComplete="new-password"
              maxLength={128}
            />
            <PasswordStrength password={form.password} />
            {passwordErr && <p className="field-hint hint-invalid">{passwordErr}</p>}
          </div>
          <div className="form-group">
            <label>Referral Code (optional)</label>
            <input
              type="text"
              value={form.referral_code}
              onChange={set('referral_code')}
              autoComplete="off"
              maxLength={20}
            />
          </div>
          {HCAPTCHA_SITE_KEY && (
            <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITE_KEY} size="invisible" />
          )}
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Free Account'}
          </button>
        </form>
        <p className={styles.switch}>Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
