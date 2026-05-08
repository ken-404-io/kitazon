import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../context/AuthContext';
import { sanitizeEmail, isValidEmail, validateEmailField } from '../utils/sanitize';
import PasswordInput from '../components/ui/PasswordInput';
import styles from './Auth.module.css';

const GOOGLE_REDIRECT = `${process.env.REACT_APP_API_URL ?? 'https://api.kitazon.com'}/api/auth/google/redirect`;

const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY ?? '';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm]           = useState({ email: '', password: '' });
  const [touched, setTouched]     = useState({ email: false, password: false, totp: false });
  const [totpCode, setTotpCode]   = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const blur = (f: keyof typeof touched) => () => setTouched(p => ({ ...p, [f]: true }));

  const emailErr    = touched.email    ? validateEmailField(form.email) : null;
  const passwordErr = touched.password ? (!form.password ? 'Password is required.' : null) : null;
  const totpErr     = touched.totp && requiresTotp
    ? (!totpCode ? '6-digit code is required.' : (!/^\d{6}$/.test(totpCode) ? 'Code must be exactly 6 digits.' : null))
    : null;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    const email = sanitizeEmail(form.email);
    if (!isValidEmail(email)) { setTouched(p => ({ ...p, email: true })); return; }
    if (!form.password) { setTouched(p => ({ ...p, password: true })); return; }

    setLoading(true);
    try {
      let captchaToken: string | undefined;
      if (HCAPTCHA_SITE_KEY) {
        const result = await captchaRef.current?.execute({ async: true });
        captchaToken = result?.response;
      }
      await login(email, form.password, captchaToken, requiresTotp ? totpCode : undefined);
    } catch (err: unknown) {
      captchaRef.current?.resetCaptcha();
      const data = (err as { response?: { data?: { message?: string; requires_totp?: boolean } } }).response?.data;
      if (data?.requires_totp) { setRequiresTotp(true); setError(''); return; }
      setError(data?.message ?? 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>Welcome back</h2>
        <p className={styles.sub}>Login to your Kitazon account</p>

        {/* Google Sign-In */}
        <div className={styles.googleWrap}>
          <a href={GOOGLE_REDIRECT} className={styles.googleBtn}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </a>
        </div>

        <div className={styles.divider}><span>or</span></div>

        <form onSubmit={submit} autoComplete="on" noValidate>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              onBlur={blur('email')}
              className={touched.email ? (emailErr ? 'field-invalid' : 'field-valid') : ''}
              required
              autoFocus
              autoComplete="email"
              maxLength={254}
            />
            {emailErr && <p className="field-hint hint-invalid">{emailErr}</p>}
          </div>
          <div className="form-group">
            <label>Password</label>
            <PasswordInput
              value={form.password}
              onChange={set('password')}
              onBlur={blur('password')}
              inputClass={touched.password ? (passwordErr ? 'field-invalid' : 'field-valid') : ''}
              required
              autoComplete="current-password"
              maxLength={128}
            />
            {passwordErr && <p className="field-hint hint-invalid">{passwordErr}</p>}
          </div>
          {requiresTotp && (
            <div className="form-group">
              <label>Authenticator Code</label>
              <input
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onBlur={blur('totp')}
                className={touched.totp ? (totpErr ? 'field-invalid' : (totpCode.length === 6 ? 'field-valid' : '')) : ''}
                placeholder="000000"
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
              />
              {totpErr
                ? <p className="field-hint hint-invalid">{totpErr}</p>
                : <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Enter the 6-digit code from your authenticator app.</p>
              }
            </div>
          )}
          {HCAPTCHA_SITE_KEY && (
            <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITE_KEY} size="invisible" />
          )}
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
        <p className={styles.switch}><Link to="/forgot-password">Forgot password?</Link></p>
        <p className={styles.switch}>No account? <Link to="/register">Join free</Link></p>
      </div>
    </div>
  );
}
