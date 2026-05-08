import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../context/AuthContext';
import { sanitizeEmail, isValidEmail, validateEmailField } from '../utils/sanitize';
import styles from './Auth.module.css';

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
  const totpErr     = touched.totp && requiresTotp ? (!totpCode ? '6-digit code is required.' : (!/^\d{6}$/.test(totpCode) ? 'Code must be exactly 6 digits.' : null)) : null;

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
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              onBlur={blur('password')}
              className={touched.password ? (passwordErr ? 'field-invalid' : 'field-valid') : ''}
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
