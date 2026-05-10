import { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../context/AuthContext';
import {
  sanitizeInput, sanitizeEmail, isStrongPassword,
  validateName, validateEmailField, validatePasswordField,
} from '../utils/sanitize';
import PasswordInput from '../components/ui/PasswordInput';
import PasswordStrength from '../components/ui/PasswordStrength';
import styles from './Auth.module.css';

const GOOGLE_REDIRECT = `${process.env.REACT_APP_API_URL ?? 'https://api.kitazon.com'}/api/auth/google/redirect`;

const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY ?? '';

interface FormState {
  name: string; email: string; password: string; referral_code: string; website: string;
}

export default function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const refFromUrl = params.get('ref') ?? '';
  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', referral_code: refFromUrl, website: '',
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

    const name          = sanitizeInput(form.name);
    const email         = sanitizeEmail(form.email);
    const referral_code = sanitizeInput(form.referral_code);

    setTouched({ name: true, email: true, password: true });

    if (validateName(name)) return;
    if (validateEmailField(email)) return;
    const pwError = isStrongPassword(form.password);
    if (pwError) return;

    setLoading(true);
    try {
      let captcha_token: string | undefined;
      if (HCAPTCHA_SITE_KEY) {
        const result = await captchaRef.current?.execute({ async: true });
        captcha_token = result?.response;
      }
      await register({ name, email, password: form.password, referral_code, captcha_token, website: form.website });
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

        {/* Google Sign-Up */}
        <div className={styles.googleWrap}>
          <a href={GOOGLE_REDIRECT} className={styles.googleBtn}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign up with Google
          </a>
        </div>

        <div className={styles.divider}><span>or</span></div>

        <form onSubmit={submit} autoComplete="on" noValidate>
          {/* Honeypot — must stay empty; bots fill it, humans don't */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={set('website')}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
          />
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
            <PasswordInput
              value={form.password}
              onChange={set('password')}
              onBlur={blur('password')}
              inputClass={touched.password ? (passwordErr ? 'field-invalid' : 'field-valid') : ''}
              required
              autoComplete="new-password"
              maxLength={128}
            />
            <PasswordStrength password={form.password} />
            {passwordErr && <p className="field-hint hint-invalid">{passwordErr}</p>}
          </div>
          <div className="form-group">
            <label>Referral Code {refFromUrl ? '' : '(optional)'}</label>
            <input
              type="text"
              value={form.referral_code}
              onChange={refFromUrl ? undefined : set('referral_code')}
              readOnly={!!refFromUrl}
              autoComplete="off"
              maxLength={20}
              style={refFromUrl ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
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
